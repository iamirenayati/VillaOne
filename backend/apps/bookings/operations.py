from decimal import Decimal
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone

from apps.marketplace.models import BusinessSettings
from apps.villas.models import Availability, Villa

from .models import Booking, Payment


def check_operational_integrity():
    issues = []
    active = Booking.objects.filter(status__in=[Booking.Status.PENDING_OWNER, Booking.Status.CONFIRMED])
    for booking in active.select_related("villa").order_by("villa_id", "checkin", "pk"):
        conflict = active.filter(
            villa_id=booking.villa_id,
            checkin__lt=booking.checkout,
            checkout__gt=booking.checkin,
        ).exclude(pk=booking.pk).exists()
        if conflict:
            issues.append({"code": "booking_overlap", "booking": booking.code})
        service_total = booking.service_items.aggregate(
            total=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=DecimalField(max_digits=14, decimal_places=0)))
        )["total"] or Decimal("0")
        if booking.stay_total + service_total != booking.total_price or service_total != booking.services_total:
            issues.append({"code": "booking_total_mismatch", "booking": booking.code})
        if booking.deposit_paid_online + booking.remaining_amount != booking.total_price:
            issues.append({"code": "booking_balance_mismatch", "booking": booking.code})
        if booking.status == Booking.Status.CONFIRMED:
            expected = (booking.checkout - booking.checkin).days
            occupied = Availability.objects.filter(
                villa=booking.villa,
                date__gte=booking.checkin,
                date__lt=booking.checkout,
                status=Availability.Status.BOOKED,
                note=booking.code,
            ).count()
            if occupied != expected:
                issues.append({"code": "calendar_occupancy_mismatch", "booking": booking.code})
    stale_payments = Payment.objects.filter(
        status=Payment.Status.PENDING,
        booking__expires_at__lt=timezone.now(),
    ).values_list("pk", flat=True)
    issues.extend({"code": "stale_pending_payment", "payment_id": pk} for pk in stale_payments)
    for payment in Payment.objects.exclude(proof_image="").only("pk", "proof_image"):
        try:
            exists = payment.proof_image.storage.exists(payment.proof_image.name)
        except OSError:
            exists = False
        if not exists:
            issues.append({"code": "missing_payment_proof", "payment_id": payment.pk})
    business = BusinessSettings.objects.filter(pk=1).first()
    if not business or not business.is_launch_ready:
        issues.append({"code": "business_settings_incomplete"})
    if not Villa.objects.filter(status=Villa.Status.PUBLISHED).exists():
        issues.append({"code": "published_villa_missing"})
    return issues
