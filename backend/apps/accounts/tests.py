from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from .models import User


class OTPAuthenticationTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def test_database_limit_rejects_sixth_otp_request_for_phone(self):
        phone = "09121112222"
        for _ in range(5):
            response = self.client.post(reverse("otp-request"), {"phone": phone}, format="json", REMOTE_ADDR="192.0.2.10")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        limited = self.client.post(reverse("otp-request"), {"phone": phone}, format="json", REMOTE_ADDR="192.0.2.10")

        self.assertIn(limited.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_429_TOO_MANY_REQUESTS))

    def test_authenticated_user_can_blacklist_refresh_token(self):
        user = User.objects.create_user(username="logout-user", phone="09120000078")
        refresh = RefreshToken.for_user(user)
        self.client.force_authenticate(user)

        response = self.client.post(reverse("logout"), {"refresh": str(refresh)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists())

    def test_request_and_verify_debug_otp(self):
        request_response = self.client.post(reverse("otp-request"), {"phone": "09121234567"}, format="json")
        self.assertEqual(request_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(request_response.data["debug_code"], "123456")

        verify_response = self.client.post(
            reverse("otp-verify"),
            {"phone": "09121234567", "code": "123456"},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", verify_response.data)
        self.assertTrue(User.objects.get(phone="09121234567").is_phone_verified)

    def test_invalid_phone_is_rejected(self):
        response = self.client.post(reverse("otp-request"), {"phone": "123"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guest_can_update_notification_preferences(self):
        user = User.objects.create_user(username="guest", phone="09120000009", is_phone_verified=True)
        self.client.force_authenticate(user)
        response = self.client.patch(reverse("me"), {
            "booking_sms_enabled": False,
            "marketing_sms_enabled": True,
            "email_notifications_enabled": True,
        }, format="json")

        user.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(user.booking_sms_enabled)
        self.assertTrue(user.marketing_sms_enabled)
        self.assertTrue(user.email_notifications_enabled)
