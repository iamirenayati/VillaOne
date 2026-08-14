from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        GUEST = "guest", "مهمان"
        OWNER = "owner", "مالک"
        VENDOR = "vendor", "فروشنده"
        CONTENT_ADMIN = "content_admin", "ادمین محتوا"
        FINANCE_ADMIN = "finance_admin", "ادمین مالی"
        SUPER_ADMIN = "super_admin", "سوپر ادمین"

    phone = models.CharField(max_length=15, unique=True)
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.GUEST)
    is_phone_verified = models.BooleanField(default=False)
    booking_sms_enabled = models.BooleanField(default=True)
    marketing_sms_enabled = models.BooleanField(default=False)
    email_notifications_enabled = models.BooleanField(default=False)

    def __str__(self):
        return self.get_full_name() or self.phone


class OTPChallenge(models.Model):
    phone = models.CharField(max_length=15, db_index=True)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField(db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    request_ip = models.GenericIPAddressField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self):
        return self.verified_at is None and self.expires_at > timezone.now() and self.attempts < 5
