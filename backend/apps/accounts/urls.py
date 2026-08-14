from django.urls import path
from .views import LogoutView, MeView, OTPRequestView, OTPVerifyView

urlpatterns = [
    path("otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("me/", MeView.as_view(), name="me"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
