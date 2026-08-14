from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible
from django.db import models

from apps.villas.models import Villa

@deconstructible
class PaymentProofStorage(FileSystemStorage):
    def __init__(self):
        super().__init__(location=settings.PRIVATE_MEDIA_ROOT)


private_payment_proof_storage = PaymentProofStorage()


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING_OWNER = "pending_owner", "در انتظار تأیید"
        CONFIRMED = "confirmed", "تأییدشده"
        CANCELLED = "cancelled", "لغوشده"
        COMPLETED = "completed", "تکمیل‌شده"
        EXPIRED = "expired", "منقضی‌شده"

    class RemainingPaymentMethod(models.TextChoices):
        CASH = "cash", "نقدی"
        CARD_ON_ARRIVAL = "card_on_arrival", "کارت در محل"
        ONLINE_LATER = "online_later", "آنلاین بعدی"

    class PaymentPlan(models.TextChoices):
        DEPOSIT = "deposit", "بیعانه"
        FULL = "full", "پرداخت کامل"

    code = models.CharField(max_length=32, unique=True, db_index=True)
    villa = models.ForeignKey(Villa, on_delete=models.PROTECT, related_name="bookings")
    guest = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings")
    checkin = models.DateField(db_index=True)
    checkout = models.DateField(db_index=True)
    guests_count = models.PositiveSmallIntegerField()
    total_price = models.DecimalField(max_digits=14, decimal_places=0)
    stay_total = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    services_total = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    payment_plan = models.CharField(max_length=12, choices=PaymentPlan.choices, default=PaymentPlan.DEPOSIT)
    amount_due_now = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    deposit_paid_online = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    remaining_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    remaining_payment_method = models.CharField(max_length=24, choices=RemainingPaymentMethod.choices, default=RemainingPaymentMethod.CARD_ON_ARRIVAL)
    cancellation_policy_applied = models.JSONField(default=dict, blank=True)
    refund_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING_OWNER, db_index=True)
    guest_note = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    client_request_id = models.CharField(max_length=80, null=True, blank=True, unique=True)
    request_fingerprint = models.CharField(max_length=64, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["villa", "checkin", "checkout"]), models.Index(fields=["guest", "status"])]

    def clean(self):
        if self.checkout <= self.checkin:
            raise ValidationError("تاریخ خروج باید بعد از تاریخ ورود باشد.")
        if self.villa_id and self.guests_count > self.villa.capacity:
            raise ValidationError("تعداد مهمان از ظرفیت ویلا بیشتر است.")

    def __str__(self):
        return f"{self.code} — {self.villa}"


class BookingService(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "در انتظار هماهنگی"
        CONFIRMED = "confirmed", "تأیید شده"
        UNAVAILABLE = "unavailable", "ناموجود"
        COMPLETED = "completed", "انجام شده"
        CANCELLED = "cancelled", "لغو شده"

    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="service_items")
    service = models.ForeignKey("marketplace.ServiceOffer", on_delete=models.PROTECT, related_name="booking_items")
    title = models.CharField(max_length=160)
    unit_price = models.DecimalField(max_digits=14, decimal_places=0)
    quantity = models.PositiveSmallIntegerField(default=1)
    pricing_model = models.CharField(max_length=16, default="fixed")
    unit_label = models.CharField(max_length=40, default="خدمت")
    service_date = models.DateField(null=True, blank=True, db_index=True)
    time_slot = models.CharField(max_length=24, blank=True)
    customer_note = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.REQUESTED)
    admin_note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["booking", "service"], name="unique_booking_service")]

    @property
    def total_price(self):
        return self.unit_price * self.quantity


class Payment(models.Model):
    class Gateway(models.TextChoices):
        CARD_TO_CARD = "card_to_card", "کارت به کارت"
        MANUAL = "manual", "ثبت دستی"
        ZARINPAL = "zarinpal", "زرین‌پال"
        ZIBAL = "zibal", "زیبال"
        IDPAY = "idpay", "آی‌دی‌پی"

    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار"
        PAID = "paid", "پرداخت‌شده"
        PARTIALLY_PAID = "partially_paid", "پرداخت جزئی"
        REFUNDED = "refunded", "بازگشت‌داده‌شده"
        FAILED = "failed", "ناموفق"

    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="payments")
    gateway = models.CharField(max_length=16, choices=Gateway.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    authority = models.CharField(max_length=120, blank=True)
    reference_id = models.CharField(max_length=120, blank=True, db_index=True)
    proof_image = models.ImageField(storage=private_payment_proof_storage, upload_to="payment-proofs/%Y/%m/", blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="reviewed_payments")
    review_note = models.TextField(blank=True)
    attempt_number = models.PositiveSmallIntegerField(default=1)
    client_request_id = models.CharField(max_length=80, null=True, blank=True, unique=True)
    request_fingerprint = models.CharField(max_length=64, blank=True, editable=False)
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CancellationRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "در انتظار بررسی"
        APPROVED = "approved", "تأییدشده"
        REJECTED = "rejected", "ردشده"
        REFUNDED = "refunded", "وجه بازگردانده شد"

    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="cancellation_requests")
    reason = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.REQUESTED, db_index=True)
    admin_note = models.TextField(blank=True)
    refund_percentage = models.PositiveSmallIntegerField(default=0)
    estimated_refund_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    requested_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"{self.booking.code} — {self.get_status_display()}"


class AdminAuditLog(models.Model):
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="admin_audit_logs")
    system_actor = models.CharField(max_length=80, blank=True)
    action = models.CharField(max_length=80)
    target_type = models.CharField(max_length=80)
    target_id = models.CharField(max_length=80)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class CustomerNotification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="customer_notifications")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    kind = models.CharField(max_length=48, db_index=True)
    title = models.CharField(max_length=160)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at", "created_at"])]


class OperationalTaskRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    task_name = models.CharField(max_length=80, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    processed_count = models.PositiveIntegerField(default=0)
    error_summary = models.CharField(max_length=500, blank=True)
    details = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["task_name"]


class SupportTicket(models.Model):
    class Category(models.TextChoices):
        BOOKING = "booking", "رزرو"
        PAYMENT = "payment", "پرداخت"
        CANCELLATION = "cancellation", "لغو و بازگشت وجه"
        STAY = "stay", "اقامت و ورود"
        OTHER = "other", "سایر"

    class Status(models.TextChoices):
        OPEN = "open", "باز"
        IN_PROGRESS = "in_progress", "در حال بررسی"
        ANSWERED = "answered", "پاسخ داده شد"
        CLOSED = "closed", "بسته"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="support_tickets")
    booking = models.ForeignKey(Booking, on_delete=models.PROTECT, related_name="support_tickets", null=True, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    subject = models.CharField(max_length=160)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    admin_response = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"#{self.pk} — {self.subject}"


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی"
        APPROVED = "approved", "تأییدشده"
        REJECTED = "rejected", "ردشده"

    booking = models.OneToOneField(Booking, on_delete=models.PROTECT, related_name="review")
    villa = models.ForeignKey(Villa, on_delete=models.PROTECT, related_name="reviews")
    guest = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=120, blank=True)
    comment = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["villa", "status", "created_at"])]

    def __str__(self):
        return f"{self.booking.code} — {self.rating}/5"
