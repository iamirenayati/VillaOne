import secrets
import hashlib
import json
from io import BytesIO
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import IntegrityError, connection, transaction
from django.db.models import Q
from django.utils import timezone

from apps.villas.models import Availability, PriceOverride, Villa
from .models import AdminAuditLog, Booking, BookingService, CancellationRequest, CustomerNotification, Payment
from apps.marketplace.models import ServiceAvailability, ServiceOffer


ACTIVE_BOOKING_STATUSES = [Booking.Status.PENDING_OWNER, Booking.Status.CONFIRMED]


def validate_stay_dates(checkin, checkout):
    if checkout <= checkin:
        raise ValidationError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
    if checkin < timezone.localdate():
        raise ValidationError("تاریخ ورود نمی‌تواند در گذشته باشد.")
    if (checkout - checkin).days < 2:
        raise ValidationError("حداقل مدت اقامت ۲ شب است.")


def active_booking_filter(now=None):
    now = now or timezone.now()
    return Q(status=Booking.Status.CONFIRMED) | Q(status=Booking.Status.PENDING_OWNER, expires_at__gt=now) | Q(status=Booking.Status.PENDING_OWNER, deposit_paid_online__gt=0)


def notify_customer(*, user, kind, title, message, booking=None, metadata=None):
    return CustomerNotification.objects.create(
        user=user,
        booking=booking,
        kind=kind,
        title=title,
        message=message,
        metadata=metadata or {},
    )


def expire_stale_bookings(now=None, *, batch_size=100, system_actor="operational_tasks"):
    """Expire unpaid holds in bounded, lock-safe batches.

    The function is safe to call from both request paths and the scheduled worker.
    PostgreSQL workers skip rows already locked by another worker; SQLite keeps the
    same behavior without claiming concurrency guarantees it cannot provide.
    """
    now = now or timezone.now()
    with transaction.atomic():
        candidates = Booking.objects.filter(
            status=Booking.Status.PENDING_OWNER,
            deposit_paid_online=0,
            expires_at__lte=now,
        ).order_by("expires_at", "pk")
        if connection.features.has_select_for_update_skip_locked:
            candidates = candidates.select_for_update(skip_locked=True)
        else:
            candidates = candidates.select_for_update()
        rows = list(candidates.select_related("guest")[:batch_size])
        for booking in rows:
            booking.status = Booking.Status.EXPIRED
            booking.save(update_fields=["status", "updated_at"])
            booking.payments.filter(status=Payment.Status.PENDING).update(
                status=Payment.Status.FAILED,
                reviewed_at=now,
                review_note="Booking hold expired automatically.",
                updated_at=now,
            )
            AdminAuditLog.objects.create(
                admin=None,
                system_actor=system_actor,
                action="booking.expired",
                target_type="Booking",
                target_id=str(booking.pk),
                metadata={"booking_code": booking.code},
            )
            notify_customer(
                user=booking.guest,
                booking=booking,
                kind="booking_expired",
                title="مهلت رزرو پایان یافت",
                message="مهلت پرداخت این درخواست رزرو پایان یافت و تاریخ‌ها آزاد شدند.",
                metadata={"booking_code": booking.code},
            )
    return len(rows)


def _request_fingerprint(payload):
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def card_transfer_instructions(booking):
    from apps.marketplace.models import BusinessSettings
    try:
        business = BusinessSettings.current()
    except BusinessSettings.DoesNotExist as exc:
        raise ValidationError("اطلاعات کارت پرداخت هنوز تنظیم نشده است.") from exc
    if not (business.card_transfer_enabled and business.card_transfer_bank_name and business.card_transfer_cardholder_name and business.card_transfer_card_number):
        raise ValidationError("پرداخت کارت به کارت هنوز فعال نشده است.")
    return {
        "amount": str(booking.amount_due_now - booking.deposit_paid_online),
        "bank_name": business.card_transfer_bank_name,
        "cardholder_name": business.card_transfer_cardholder_name,
        "card_number": business.card_transfer_card_number,
        "expires_at": booking.expires_at,
    }


def normalized_proof_image(upload):
    try:
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = 25_000_000
        image = Image.open(upload)
        image.verify()
        upload.seek(0)
        image = Image.open(upload)
        width, height = image.size
        if width < 300 or height < 300 or width > 12_000 or height > 12_000 or width * height > 25_000_000:
            raise ValidationError("ابعاد تصویر رسید معتبر نیست.")
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((2000, 2000))
        output = BytesIO()
        image.save(output, format="WEBP", quality=88, method=6)
    except Exception as exc:
        raise ValidationError("فایل رسید یک تصویر معتبر نیست.") from exc
    return ContentFile(output.getvalue(), name="receipt.webp")


@transaction.atomic
def submit_card_transfer(*, booking, proof_image, reference_id="", client_request_id=None):
    expire_stale_bookings()
    locked = Booking.objects.select_for_update().get(pk=booking.pk)
    request_payload = {
        "booking_id": locked.pk,
        "reference_id": reference_id.strip(),
    }
    fingerprint = _request_fingerprint(request_payload)
    client_request_id = client_request_id or None
    if client_request_id:
        existing = Payment.objects.select_for_update().filter(client_request_id=client_request_id).first()
        if existing:
            if existing.booking_id != locked.pk or existing.request_fingerprint != fingerprint:
                raise ValidationError("این شناسه ارسال رسید قبلاً برای اطلاعات متفاوت استفاده شده است.")
            return existing
    if locked.status != Booking.Status.PENDING_OWNER or not locked.expires_at or locked.expires_at <= timezone.now():
        raise ValidationError("مهلت این درخواست گذشته یا رزرو نهایی شده است.")
    card_transfer_instructions(locked)
    if locked.payments.filter(gateway=Payment.Gateway.CARD_TO_CARD, status=Payment.Status.PENDING).exists():
        raise ValidationError("رسید شما در حال بررسی است.")
    attempts = locked.payments.filter(gateway=Payment.Gateway.CARD_TO_CARD).count()
    if attempts >= 2:
        raise ValidationError("امکان ارسال رسید جدید برای این رزرو وجود ندارد.")
    proof_image = normalized_proof_image(proof_image)
    payment_fields = {
        "booking": locked,
        "gateway": Payment.Gateway.CARD_TO_CARD,
        "amount": locked.amount_due_now - locked.deposit_paid_online,
        "proof_image": proof_image,
        "reference_id": reference_id.strip(),
        "submitted_at": timezone.now(),
        "attempt_number": attempts + 1,
        "client_request_id": client_request_id,
        "request_fingerprint": fingerprint,
    }
    try:
        with transaction.atomic():
            payment = Payment.objects.create(**payment_fields)
    except IntegrityError:
        if not client_request_id:
            raise
        existing = Payment.objects.select_for_update().filter(client_request_id=client_request_id).first()
        if not existing:
            raise
        if existing.booking_id != locked.pk or existing.request_fingerprint != fingerprint:
            raise ValidationError("این شناسه ارسال رسید قبلاً برای اطلاعات متفاوت استفاده شده است.")
        return existing
    locked.expires_at = timezone.now() + timedelta(hours=24)
    locked.save(update_fields=["expires_at", "updated_at"])
    notify_customer(
        user=locked.guest,
        booking=locked,
        kind="payment_submitted",
        title="رسید پرداخت دریافت شد",
        message="رسید کارت‌به‌کارت شما دریافت شد و در صف بررسی مالی قرار گرفت.",
        metadata={"booking_code": locked.code, "payment_id": payment.pk},
    )
    return payment


@transaction.atomic
def review_card_transfer(*, payment, admin_user, approve, review_note=""):
    payment_context = Payment.objects.only("booking_id").get(pk=payment.pk)
    booking_context = Booking.objects.only("villa_id").get(pk=payment_context.booking_id)
    Villa.objects.select_for_update().get(pk=booking_context.villa_id)
    booking = Booking.objects.select_for_update().select_related("villa").get(pk=payment_context.booking_id)
    locked = Payment.objects.select_for_update().get(pk=payment.pk)
    desired_status = Payment.Status.PAID if approve else Payment.Status.FAILED
    if locked.gateway == Payment.Gateway.CARD_TO_CARD and locked.status == desired_status:
        return locked
    if locked.gateway != Payment.Gateway.CARD_TO_CARD or locked.status != Payment.Status.PENDING:
        raise ValidationError("فقط رسیدهای در انتظار قابل بررسی هستند.")
    if booking.status != Booking.Status.PENDING_OWNER or not booking.expires_at or booking.expires_at <= timezone.now():
        raise ValidationError("مهلت این رزرو گذشته است؛ رسید قابل تأیید نیست.")
    now = timezone.now()
    locked.reviewed_at = now
    locked.reviewed_by = admin_user
    locked.review_note = review_note.strip()
    if not approve:
        locked.status = Payment.Status.FAILED
        locked.save(update_fields=["status", "reviewed_at", "reviewed_by", "review_note", "updated_at"])
        if locked.attempt_number == 1:
            booking.expires_at = now + timedelta(hours=2)
            booking.save(update_fields=["expires_at", "updated_at"])
        else:
            booking.status = Booking.Status.EXPIRED
            booking.save(update_fields=["status", "updated_at"])
        AdminAuditLog.objects.create(admin=admin_user, action="payment.card_transfer_rejected", target_type="Payment", target_id=str(locked.pk), metadata={"booking_code": booking.code, "reason": locked.review_note})
        notify_customer(
            user=booking.guest,
            booking=booking,
            kind="payment_rejected",
            title="رسید پرداخت تأیید نشد",
            message=locked.review_note,
            metadata={"booking_code": booking.code, "payment_id": locked.pk},
        )
        return locked
    conflict = Booking.objects.filter(villa=booking.villa, status=Booking.Status.CONFIRMED, checkin__lt=booking.checkout, checkout__gt=booking.checkin).exclude(pk=booking.pk).exists()
    blocked = Availability.objects.filter(villa=booking.villa, date__gte=booking.checkin, date__lt=booking.checkout, status__in=[Availability.Status.BLOCKED, Availability.Status.BOOKED]).exclude(note=booking.code).exists()
    if conflict or blocked:
        raise ValidationError("این بازه دیگر در دسترس نیست؛ رسید تأیید نشد.")
    locked.status = Payment.Status.PAID
    locked.save(update_fields=["status", "reviewed_at", "reviewed_by", "review_note", "updated_at"])
    booking.deposit_paid_online = min(booking.total_price, booking.deposit_paid_online + locked.amount)
    booking.remaining_amount = max(Decimal("0"), booking.total_price - booking.deposit_paid_online)
    booking.status = Booking.Status.CONFIRMED
    booking.save(update_fields=["deposit_paid_online", "remaining_amount", "status", "updated_at"])
    for day in daterange(booking.checkin, booking.checkout):
        Availability.objects.update_or_create(villa=booking.villa, date=day, defaults={"status": Availability.Status.BOOKED, "note": booking.code})
    AdminAuditLog.objects.create(admin=admin_user, action="payment.card_transfer_approved", target_type="Payment", target_id=str(locked.pk), metadata={"booking_code": booking.code, "amount": str(locked.amount)})
    AdminAuditLog.objects.create(admin=admin_user, action="booking.confirmed", target_type="Booking", target_id=str(booking.pk), metadata={"booking_code": booking.code, "source": "card_transfer"})
    notify_customer(
        user=booking.guest,
        booking=booking,
        kind="payment_approved",
        title="رزرو شما تأیید شد",
        message="رسید پرداخت تأیید شد و رزرو شما نهایی است.",
        metadata={"booking_code": booking.code, "payment_id": locked.pk},
    )
    return locked


def cancellation_quote(booking, *, today=None):
    today = today or timezone.localdate()
    days_before = (booking.checkin - today).days
    policy = booking.cancellation_policy_applied or {}
    if days_before > 7:
        percentage = int(policy.get("more_than_7_days", 90))
    elif days_before >= 3:
        percentage = int(policy.get("between_3_and_7_days", 50))
    else:
        percentage = int(policy.get("less_than_3_days", 0))
    percentage = max(0, min(100, percentage))
    paid = booking.deposit_paid_online
    amount = (paid * Decimal(percentage) / Decimal("100")).quantize(Decimal("1"))
    return {"days_before_checkin": days_before, "refund_percentage": percentage, "estimated_refund_amount": amount}


def daterange(start, end):
    for offset in range((end - start).days):
        yield start + timedelta(days=offset)


def calculate_booking_price(villa, checkin, checkout):
    overrides = {item.date: item.price for item in PriceOverride.objects.filter(villa=villa, date__gte=checkin, date__lt=checkout)}
    total = Decimal("0")
    for day in daterange(checkin, checkout):
        if day in overrides:
            total += overrides[day]
        elif day.weekday() in (3, 4):
            total += villa.price_weekend
        else:
            total += villa.price_weekday
    return total


def normalize_service_selections(service_slugs=None, service_items=None):
    if service_items:
        selections = [dict(item) for item in service_items]
    else:
        selections = [{"slug": slug, "quantity": 1, "time_slot": "", "note": ""} for slug in (service_slugs or [])]
    slugs = [item["slug"] for item in selections]
    if len(slugs) != len(set(slugs)):
        raise ValidationError("هر خدمت فقط یک‌بار قابل انتخاب است.")
    if len(slugs) > 8:
        raise ValidationError("حداکثر ۸ خدمت قابل انتخاب است.")
    return selections


def selected_services(service_slugs=None, service_items=None):
    selections = normalize_service_selections(service_slugs, service_items)
    slugs = [item["slug"] for item in selections]
    services = list(ServiceOffer.objects.prefetch_related("eligible_villas").filter(slug__in=slugs, status=ServiceOffer.Status.PUBLISHED))
    by_slug = {service.slug: service for service in services}
    missing = [slug for slug in slugs if slug not in by_slug]
    if missing:
        raise ValidationError("یکی از خدمات انتخاب‌شده دیگر در دسترس نیست.")
    return [(by_slug[item["slug"]], item) for item in selections]


def priced_service_selections(*, villa, checkin, checkout, guests_count, service_slugs=None, service_items=None, lock_capacity=False):
    nights = (checkout - checkin).days
    priced = []
    for service, selection in selected_services(service_slugs, service_items):
        if service.fulfillment_mode not in (ServiceOffer.FulfillmentMode.BOOKABLE, ServiceOffer.FulfillmentMode.BOTH):
            raise ValidationError(f"خدمت «{service.title}» فقط با هماهنگی کانسیرج قابل درخواست است.")
        if service.eligible_villas.exists() and not service.eligible_villas.filter(pk=villa.pk).exists():
            raise ValidationError(f"خدمت «{service.title}» برای این ویلا ارائه نمی‌شود.")

        requested_date = selection.get("service_date")
        if service.schedule_type == ServiceOffer.ScheduleType.STAY_DATE:
            if not requested_date or not (checkin <= requested_date < checkout):
                raise ValidationError(f"تاریخ «{service.title}» باید یکی از روزهای اقامت باشد.")
            service_date = requested_date
        elif service.schedule_type == ServiceOffer.ScheduleType.CHECKOUT:
            service_date = checkout
        else:
            service_date = checkin

        if service.minimum_lead_hours:
            service_start = timezone.make_aware(datetime.combine(service_date, time.min), timezone.get_current_timezone())
            if service_start < timezone.now() + timedelta(hours=service.minimum_lead_hours):
                raise ValidationError(f"برای «{service.title}» دست‌کم {service.minimum_lead_hours} ساعت زمان هماهنگی لازم است.")

        availability_query = ServiceAvailability.objects.filter(service=service, date=service_date)
        if lock_capacity:
            availability, _ = ServiceAvailability.objects.get_or_create(service=service, date=service_date)
            availability = ServiceAvailability.objects.select_for_update().get(pk=availability.pk)
        else:
            availability = availability_query.first()
        if availability and availability.status in (ServiceAvailability.Status.BLOCKED, ServiceAvailability.Status.CLOSED):
            raise ValidationError(f"خدمت «{service.title}» در تاریخ انتخاب‌شده در دسترس نیست.")
        capacity = availability.capacity_override if availability and availability.capacity_override is not None else service.default_daily_capacity
        reserved = BookingService.objects.filter(
            service=service,
            service_date=service_date,
            booking__status__in=ACTIVE_BOOKING_STATUSES,
        ).exclude(status__in=[BookingService.Status.UNAVAILABLE, BookingService.Status.CANCELLED]).count()
        if reserved >= capacity:
            raise ValidationError(f"ظرفیت «{service.title}» در تاریخ انتخاب‌شده تکمیل است.")

        if service.pricing_model == ServiceOffer.PricingModel.PER_GUEST:
            quantity = guests_count
        elif service.pricing_model == ServiceOffer.PricingModel.PER_NIGHT:
            quantity = nights
        elif service.pricing_model == ServiceOffer.PricingModel.PER_UNIT:
            quantity = int(selection.get("quantity") or 1)
            if not service.minimum_quantity <= quantity <= service.maximum_quantity:
                raise ValidationError(f"تعداد «{service.title}» باید بین {service.minimum_quantity} و {service.maximum_quantity} باشد.")
        else:
            quantity = 1
        unit_price = availability.price_override if availability and availability.price_override is not None else service.base_price
        priced.append({
            "service": service,
            "slug": service.slug,
            "title": service.title,
            "unit_price": unit_price,
            "quantity": quantity,
            "total_price": unit_price * quantity,
            "pricing_model": service.pricing_model,
            "unit_label": service.unit_label,
            "service_date": service_date,
            "time_slot": selection.get("time_slot", ""),
            "customer_note": selection.get("note", "").strip(),
        })
    return priced


def quote_booking(*, villa, checkin, checkout, guests_count, payment_type, service_slugs=None, service_items=None):
    expire_stale_bookings()
    validate_stay_dates(checkin, checkout)
    if checkout <= checkin:
        raise ValidationError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
    if guests_count > villa.capacity:
        raise ValidationError("تعداد مهمان از ظرفیت ویلا بیشتر است.")
    unavailable = Booking.objects.filter(
        villa=villa,
        checkin__lt=checkout,
        checkout__gt=checkin,
    ).filter(active_booking_filter()).exists() or Availability.objects.filter(
        villa=villa,
        date__gte=checkin,
        date__lt=checkout,
        status__in=[Availability.Status.BLOCKED, Availability.Status.BOOKED],
    ).exists()
    if unavailable:
        raise ValidationError("این بازه زمانی در دسترس نیست.")
    stay_total = calculate_booking_price(villa, checkin, checkout)
    services = priced_service_selections(villa=villa, checkin=checkin, checkout=checkout, guests_count=guests_count, service_slugs=service_slugs, service_items=service_items)
    services_total = sum((service["total_price"] for service in services), Decimal("0"))
    total = stay_total + services_total
    due_now = total if payment_type == "full" else (total * Decimal(villa.deposit_percentage) / Decimal("100")).quantize(Decimal("1"))
    return {
        "nights": (checkout - checkin).days,
        "stay_total": stay_total,
        "services_total": services_total,
        "services": [{key: (value.isoformat() if key == "service_date" and value else value) for key, value in service.items() if key != "service"} for service in services],
        "service_fee": Decimal("0"),
        "discount": Decimal("0"),
        "total_price": total,
        "amount_due_now": due_now,
        "remaining_amount": total - due_now,
        "deposit_percentage": villa.deposit_percentage,
    }


def booking_code():
    return f"V1-{timezone.localdate():%y%m}-{secrets.randbelow(100000):05d}"


@transaction.atomic
def initiate_payment(*, booking):
    expire_stale_bookings()
    locked = Booking.objects.select_for_update().get(pk=booking.pk)
    if locked.status == Booking.Status.EXPIRED:
        raise ValidationError("مهلت پرداخت این درخواست تمام شده است؛ دوباره رزرو کنید.")
    existing = locked.payments.filter(status__in=[Payment.Status.PENDING, Payment.Status.PAID]).order_by("-created_at").first()
    if existing:
        return existing
    if not settings.PAYMENT_MOCK_ENABLED:
        raise ValidationError("درگاه پرداخت هنوز برای محیط عملیاتی پیکربندی نشده است.")
    amount = locked.amount_due_now - locked.deposit_paid_online
    if amount <= 0:
        raise ValidationError("مبلغ قابل پرداختی برای این رزرو باقی نمانده است.")
    return Payment.objects.create(
        booking=locked,
        gateway=Payment.Gateway.ZARINPAL,
        amount=amount,
        authority=f"LOCAL-{secrets.token_urlsafe(24)}",
        raw_response={"mode": "local_mock", "initiated_at": timezone.now().isoformat()},
    )


@transaction.atomic
def complete_mock_payment(*, payment, success):
    if not settings.PAYMENT_MOCK_ENABLED:
        raise ValidationError("پرداخت آزمایشی فقط در محیط محلی فعال است.")
    locked = Payment.objects.select_for_update().select_related("booking").get(pk=payment.pk)
    booking = Booking.objects.select_for_update().get(pk=locked.booking_id)
    if booking.status == Booking.Status.PENDING_OWNER and booking.expires_at and booking.expires_at <= timezone.now() and booking.deposit_paid_online == 0:
        booking.status = Booking.Status.EXPIRED
        booking.save(update_fields=["status", "updated_at"])
        raise ValidationError("مهلت پرداخت این درخواست تمام شده است؛ دوباره رزرو کنید.")
    if booking.status == Booking.Status.EXPIRED:
        raise ValidationError("این درخواست منقضی شده است؛ ابتدا رزرو تازه‌ای ثبت کنید.")
    if locked.status == Payment.Status.PAID:
        return locked
    if locked.status != Payment.Status.PENDING:
        raise ValidationError("این تراکنش قبلاً نهایی شده است.")
    if not success:
        locked.status = Payment.Status.FAILED
        locked.raw_response = {**locked.raw_response, "result": "failed", "completed_at": timezone.now().isoformat()}
        locked.save(update_fields=["status", "raw_response", "updated_at"])
        return locked

    locked.status = Payment.Status.PAID
    locked.reference_id = f"LOCAL-{secrets.randbelow(10**10):010d}"
    locked.raw_response = {**locked.raw_response, "result": "paid", "completed_at": timezone.now().isoformat()}
    locked.save(update_fields=["status", "reference_id", "raw_response", "updated_at"])
    booking.deposit_paid_online = min(booking.total_price, booking.deposit_paid_online + locked.amount)
    booking.remaining_amount = max(Decimal("0"), booking.total_price - booking.deposit_paid_online)
    booking.save(update_fields=["deposit_paid_online", "remaining_amount", "updated_at"])
    return locked


@transaction.atomic
def reconcile_manual_payment(*, payment, admin_user):
    locked = Payment.objects.select_for_update().select_related("booking").get(pk=payment.pk)
    if locked.status == Payment.Status.PAID:
        return locked
    if locked.status != Payment.Status.PENDING:
        raise ValidationError("فقط پرداخت در انتظار را می‌توان وصول‌شده ثبت کرد.")
    booking = Booking.objects.select_for_update().get(pk=locked.booking_id)
    locked.status = Payment.Status.PAID
    locked.reference_id = locked.reference_id or f"MANUAL-{timezone.now():%Y%m%d%H%M%S}-{locked.pk}"
    locked.raw_response = {**locked.raw_response, "mode": "manual_admin", "recorded_by": admin_user.pk, "recorded_at": timezone.now().isoformat()}
    locked.save(update_fields=["status", "reference_id", "raw_response", "updated_at"])
    booking.deposit_paid_online = min(booking.total_price, booking.deposit_paid_online + locked.amount)
    booking.remaining_amount = max(Decimal("0"), booking.total_price - booking.deposit_paid_online)
    booking.save(update_fields=["deposit_paid_online", "remaining_amount", "updated_at"])
    AdminAuditLog.objects.create(admin=admin_user, action="payment.manually_reconciled", target_type="Payment", target_id=str(locked.pk), metadata={"booking_code": booking.code, "amount": str(locked.amount)})
    return locked


@transaction.atomic
def record_manual_payment(*, booking, admin_user, amount=None):
    """Record a phone/card-transfer payment without exposing bank details publicly."""
    locked = Booking.objects.select_for_update().get(pk=booking.pk)
    expire_stale_bookings()
    locked.refresh_from_db()
    if locked.status == Booking.Status.EXPIRED:
        raise ValidationError("مهلت این درخواست گذشته است؛ ابتدا رزرو تازه‌ای ثبت کنید.")
    if locked.status in (Booking.Status.CANCELLED, Booking.Status.COMPLETED):
        raise ValidationError("برای این رزرو امکان ثبت پرداخت وجود ندارد.")
    remaining_due = locked.amount_due_now - locked.deposit_paid_online
    amount = Decimal(amount) if amount is not None else remaining_due
    if amount <= 0 or amount > (locked.total_price - locked.deposit_paid_online):
        raise ValidationError("مبلغ پرداخت دستی معتبر نیست.")
    payment = Payment.objects.create(booking=locked, gateway=Payment.Gateway.MANUAL, amount=amount)
    return reconcile_manual_payment(payment=payment, admin_user=admin_user)


@transaction.atomic
def complete_booking(*, booking, admin_user, today=None):
    locked = Booking.objects.select_for_update().get(pk=booking.pk)
    today = today or timezone.localdate()
    if locked.status != Booking.Status.CONFIRMED:
        raise ValidationError("فقط رزرو تأییدشده قابل تکمیل است.")
    if today < locked.checkout:
        raise ValidationError("پیش از تاریخ خروج نمی‌توان اقامت را تکمیل کرد.")
    locked.status = Booking.Status.COMPLETED
    locked.save(update_fields=["status", "updated_at"])
    AdminAuditLog.objects.create(admin=admin_user, action="booking.completed", target_type="Booking", target_id=str(locked.pk), metadata={"booking_code": locked.code})
    return locked


@transaction.atomic
def mark_cancellation_refunded(*, cancellation_request, admin_user):
    context = CancellationRequest.objects.only("booking_id").get(pk=cancellation_request.pk)
    booking_context = Booking.objects.only("villa_id").get(pk=context.booking_id)
    Villa.objects.select_for_update().get(pk=booking_context.villa_id)
    booking = Booking.objects.select_for_update().select_related("guest").get(pk=context.booking_id)
    cancellation = CancellationRequest.objects.select_for_update().get(pk=cancellation_request.pk)
    if cancellation.status == CancellationRequest.Status.REFUNDED:
        return cancellation
    if cancellation.status != CancellationRequest.Status.APPROVED:
        raise ValidationError("فقط لغو تأییدشده را می‌توان بازپرداخت‌شده ثبت کرد.")
    cancellation.status = CancellationRequest.Status.REFUNDED
    cancellation.resolved_at = timezone.now()
    cancellation.save(update_fields=["status", "resolved_at"])
    AdminAuditLog.objects.create(admin=admin_user, action="cancellation.refunded", target_type="CancellationRequest", target_id=str(cancellation.pk), metadata={"booking_code": booking.code, "amount": str(cancellation.estimated_refund_amount)})
    notify_customer(user=booking.guest, booking=booking, kind="cancellation_refunded", title="بازپرداخت ثبت شد", message="بازپرداخت درخواست لغو شما توسط واحد مالی ثبت شد.", metadata={"booking_code": booking.code})
    return cancellation


@transaction.atomic
def create_booking(*, guest, villa, checkin, checkout, guests_count, payment_type, guest_note="", service_slugs=None, service_items=None, client_request_id=None):
    expire_stale_bookings()
    request_payload = {
        "guest_id": guest.pk,
        "villa_id": villa.pk,
        "checkin": checkin,
        "checkout": checkout,
        "guests_count": guests_count,
        "payment_type": payment_type,
        "guest_note": guest_note,
        "service_slugs": service_slugs or [],
        "service_items": service_items or [],
    }
    fingerprint = _request_fingerprint(request_payload)
    client_request_id = client_request_id or None
    if client_request_id:
        existing = Booking.objects.select_for_update().filter(client_request_id=client_request_id).first()
        if existing:
            if existing.guest_id != guest.pk or existing.request_fingerprint != fingerprint:
                raise ValidationError("این شناسه درخواست قبلاً برای اطلاعات متفاوت استفاده شده است.")
            return existing
    locked_villa = Villa.objects.select_for_update().get(pk=villa.pk)
    validate_stay_dates(checkin, checkout)
    if checkout <= checkin:
        raise ValidationError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
    if guests_count > locked_villa.capacity:
        raise ValidationError("تعداد مهمان از ظرفیت ویلا بیشتر است.")
    if Booking.objects.filter(
        villa=locked_villa,
        checkin__lt=checkout,
        checkout__gt=checkin,
    ).filter(active_booking_filter()).exists():
        raise ValidationError("این بازه زمانی قبلاً رزرو شده است.")
    if Availability.objects.filter(
        villa=locked_villa,
        date__gte=checkin,
        date__lt=checkout,
        status__in=[Availability.Status.BLOCKED, Availability.Status.BOOKED],
    ).exists():
        raise ValidationError("یک یا چند روز این بازه در دسترس نیست.")
    stay_total = calculate_booking_price(locked_villa, checkin, checkout)
    services = priced_service_selections(villa=locked_villa, checkin=checkin, checkout=checkout, guests_count=guests_count, service_slugs=service_slugs, service_items=service_items, lock_capacity=True)
    services_total = sum((service["total_price"] for service in services), Decimal("0"))
    total = stay_total + services_total
    deposit = total if payment_type == "full" else (total * Decimal(locked_villa.deposit_percentage) / Decimal("100")).quantize(Decimal("1"))
    booking = Booking(
        code=booking_code(),
        villa=locked_villa,
        guest=guest,
        checkin=checkin,
        checkout=checkout,
        guests_count=guests_count,
        total_price=total,
        stay_total=stay_total,
        services_total=services_total,
        payment_plan=payment_type,
        amount_due_now=deposit,
        deposit_paid_online=Decimal("0"),
        remaining_amount=total,
        cancellation_policy_applied=locked_villa.cancellation_policy,
        guest_note=guest_note,
        expires_at=timezone.now() + timedelta(minutes=settings.BOOKING_HOLD_MINUTES),
        client_request_id=client_request_id,
        request_fingerprint=fingerprint,
    )
    try:
        # Keep the idempotency key out of model-level preflight validation so a
        # concurrent retry is resolved through the database's unique constraint.
        # The nested savepoint lets us recover the winning request safely.
        with transaction.atomic():
            booking.full_clean(exclude=["client_request_id"] if client_request_id else None)
            booking.save()
    except IntegrityError:
        if not client_request_id:
            raise
        existing = Booking.objects.select_for_update().filter(client_request_id=client_request_id).first()
        if not existing:
            raise
        if existing.guest_id != guest.pk or existing.request_fingerprint != fingerprint:
            raise ValidationError("این شناسه درخواست قبلاً برای اطلاعات متفاوت استفاده شده است.")
        return existing
    BookingService.objects.bulk_create([
        BookingService(
            booking=booking,
            service=item["service"],
            title=item["title"],
            unit_price=item["unit_price"],
            quantity=item["quantity"],
            pricing_model=item["pricing_model"],
            unit_label=item["unit_label"],
            service_date=item["service_date"],
            time_slot=item["time_slot"],
            customer_note=item["customer_note"],
        )
        for item in services
    ])
    notify_customer(
        user=guest,
        booking=booking,
        kind="booking_created",
        title="درخواست رزرو ثبت شد",
        message="درخواست رزرو شما ثبت شد و تا پایان مهلت نمایش‌داده‌شده منتظر پرداخت است.",
        metadata={"booking_code": booking.code},
    )
    return booking


@transaction.atomic
def decide_booking(*, booking, admin_user, approve):
    expire_stale_bookings()
    context = Booking.objects.only("villa_id").get(pk=booking.pk)
    Villa.objects.select_for_update().get(pk=context.villa_id)
    locked = Booking.objects.select_for_update().select_related("villa").get(pk=booking.pk)
    desired_status = Booking.Status.CONFIRMED if approve else Booking.Status.CANCELLED
    if locked.status == desired_status:
        return locked
    if locked.status != Booking.Status.PENDING_OWNER:
        raise ValidationError("فقط رزرو در انتظار قابل بررسی است.")
    if approve:
        conflict = Booking.objects.filter(
            villa=locked.villa,
            status=Booking.Status.CONFIRMED,
            checkin__lt=locked.checkout,
            checkout__gt=locked.checkin,
        ).exclude(pk=locked.pk).exists()
        if conflict:
            raise ValidationError("این بازه توسط رزرو دیگری قطعی شده است.")
        locked.status = Booking.Status.CONFIRMED
        locked.save(update_fields=["status", "updated_at"])
        for day in daterange(locked.checkin, locked.checkout):
            Availability.objects.update_or_create(
                villa=locked.villa,
                date=day,
                defaults={"status": Availability.Status.BOOKED, "note": locked.code},
            )
        action = "booking.confirmed"
    else:
        locked.status = Booking.Status.CANCELLED
        locked.save(update_fields=["status", "updated_at"])
        action = "booking.rejected"
    AdminAuditLog.objects.create(
        admin=admin_user,
        action=action,
        target_type="Booking",
        target_id=str(locked.pk),
        metadata={"booking_code": locked.code},
    )
    notify_customer(
        user=locked.guest,
        booking=locked,
        kind="booking_confirmed" if approve else "booking_rejected",
        title="رزرو تأیید شد" if approve else "درخواست رزرو رد شد",
        message="رزرو شما توسط تیم ویلاوان تأیید شد." if approve else "درخواست رزرو شما توسط تیم ویلاوان تأیید نشد.",
        metadata={"booking_code": locked.code},
    )
    return locked


@transaction.atomic
def resolve_cancellation(*, cancellation_request, admin_user, approve, admin_note=""):
    context = CancellationRequest.objects.only("booking_id").get(pk=cancellation_request.pk)
    booking_context = Booking.objects.only("villa_id").get(pk=context.booking_id)
    Villa.objects.select_for_update().get(pk=booking_context.villa_id)
    booking = Booking.objects.select_for_update().select_related("villa", "guest").get(pk=context.booking_id)
    cancellation = CancellationRequest.objects.select_for_update().get(pk=cancellation_request.pk)
    desired_status = CancellationRequest.Status.APPROVED if approve else CancellationRequest.Status.REJECTED
    if cancellation.status == desired_status:
        return cancellation
    if cancellation.status != CancellationRequest.Status.REQUESTED:
        raise ValidationError("فقط درخواست لغو در انتظار بررسی قابل تصمیم‌گیری است.")

    cancellation.admin_note = admin_note
    cancellation.resolved_at = timezone.now()
    if approve:
        if booking.status in (Booking.Status.CANCELLED, Booking.Status.COMPLETED):
            raise ValidationError("این رزرو دیگر قابل لغو نیست.")
        booking.status = Booking.Status.CANCELLED
        booking.refund_amount = cancellation.estimated_refund_amount
        booking.save(update_fields=["status", "refund_amount", "updated_at"])
        Availability.objects.filter(
            villa=booking.villa,
            date__gte=booking.checkin,
            date__lt=booking.checkout,
            status=Availability.Status.BOOKED,
            note=booking.code,
        ).delete()
        cancellation.status = CancellationRequest.Status.APPROVED
        action = "cancellation.approved"
    else:
        cancellation.status = CancellationRequest.Status.REJECTED
        action = "cancellation.rejected"

    cancellation.save(update_fields=["status", "admin_note", "resolved_at"])
    AdminAuditLog.objects.create(
        admin=admin_user,
        action=action,
        target_type="CancellationRequest",
        target_id=str(cancellation.pk),
        metadata={"booking_code": booking.code},
    )
    notify_customer(
        user=booking.guest,
        booking=booking,
        kind="cancellation_approved" if approve else "cancellation_rejected",
        title="درخواست لغو تأیید شد" if approve else "درخواست لغو تأیید نشد",
        message=cancellation.admin_note or ("درخواست لغو شما تأیید شد." if approve else "درخواست لغو شما تأیید نشد."),
        metadata={"booking_code": booking.code, "cancellation_id": cancellation.pk},
    )
    return cancellation
