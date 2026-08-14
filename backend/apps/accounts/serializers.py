import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTPChallenge, User


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if digits.startswith("98") and len(digits) == 12:
        digits = "0" + digits[2:]
    if not re.fullmatch(r"09\d{9}", digits):
        raise serializers.ValidationError("شماره موبایل معتبر ایرانی وارد کنید.")
    return digits


class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        return normalize_phone(value)

    def create(self, validated_data):
        phone = validated_data["phone"]
        request = self.context.get("request")
        request_ip = request.META.get("REMOTE_ADDR") if request else None
        window = timezone.now() - timedelta(minutes=10)
        if OTPChallenge.objects.filter(phone=phone, created_at__gte=window).count() >= 5:
            raise serializers.ValidationError("درخواست‌های زیادی برای این شماره ثبت شده است؛ کمی بعد دوباره تلاش کنید.")
        if request_ip and OTPChallenge.objects.filter(request_ip=request_ip, created_at__gte=window).count() >= 20:
            raise serializers.ValidationError("درخواست‌های زیادی از این اتصال ثبت شده است؛ کمی بعد دوباره تلاش کنید.")
        code = settings.OTP_DEBUG_CODE or f"{secrets.randbelow(1_000_000):06d}"
        challenge = OTPChallenge.objects.create(
            phone=phone,
            code_hash=make_password(code),
            expires_at=timezone.now() + timedelta(seconds=settings.OTP_EXPIRY_SECONDS),
            request_ip=request_ip,
        )
        challenge.debug_code = code if settings.OTP_DEBUG_CODE else None
        return challenge


class OTPVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_phone(self, value):
        return normalize_phone(value)

    def validate(self, attrs):
        challenge = OTPChallenge.objects.filter(phone=attrs["phone"], verified_at__isnull=True).first()
        if not challenge or not challenge.is_active:
            raise serializers.ValidationError("کد منقضی شده است؛ کد جدید دریافت کنید.")
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        if not check_password(attrs["code"], challenge.code_hash):
            raise serializers.ValidationError("کد تأیید نادرست است.")
        attrs["challenge"] = challenge
        return attrs

    def create(self, validated_data):
        challenge = validated_data["challenge"]
        challenge.verified_at = timezone.now()
        challenge.save(update_fields=["verified_at"])
        user, _ = User.objects.get_or_create(
            phone=validated_data["phone"],
            defaults={"username": validated_data["phone"], "is_phone_verified": True},
        )
        if not user.is_phone_verified:
            user.is_phone_verified = True
            user.save(update_fields=["is_phone_verified"])
        refresh = RefreshToken.for_user(user)
        return {"access": str(refresh.access_token), "refresh": str(refresh), "user": user}


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "phone", "first_name", "last_name", "email", "role", "is_staff", "is_phone_verified",
            "booking_sms_enabled", "marketing_sms_enabled", "email_notifications_enabled",
        )
        read_only_fields = ("phone", "role", "is_phone_verified")


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def save(self, **kwargs):
        token = RefreshToken(self.validated_data["refresh"])
        token.blacklist()
