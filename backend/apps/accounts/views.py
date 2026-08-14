from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import LogoutSerializer, OTPRequestSerializer, OTPVerifySerializer, UserSerializer


class OTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_request"

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        challenge = serializer.save()
        payload = {"message": "کد تأیید ارسال شد.", "expires_in": 120}
        if getattr(challenge, "debug_code", None):
            payload["debug_code"] = challenge.debug_code
        return Response(payload, status=status.HTTP_201_CREATED)


class OTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response({"access": result["access"], "refresh": result["refresh"], "user": UserSerializer(result["user"]).data})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
