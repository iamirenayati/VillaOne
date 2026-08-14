from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse
from django.db.models import Case, Count, IntegerField, Q, Sum, Value, When
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsBookingOperationsAdmin, IsContentOperationsAdmin, IsFinanceOperationsAdmin
from apps.marketplace.models import Inquiry
from apps.villas.models import Availability
from .models import AdminAuditLog, Booking, BookingService, CancellationRequest, CustomerNotification, OperationalTaskRun, Payment, Review, SupportTicket
from .serializers import AdminAuditLogSerializer, AdminBookingServiceSerializer, AdminCancellationActionSerializer, AdminCardTransferPaymentSerializer, AdminSupportTicketSerializer, BookingAdminActionSerializer, BookingCreateSerializer, BookingQuoteSerializer, BookingSerializer, CancellationRequestSerializer, CardTransferSubmitSerializer, CustomerNotificationSerializer, ManualPaymentRecordSerializer, MockPaymentResultSerializer, PaymentReviewSerializer, PaymentSerializer, ReviewSerializer, SupportTicketSerializer
from .services import cancellation_quote, card_transfer_instructions, complete_mock_payment, decide_booking, expire_stale_bookings, initiate_payment, mark_cancellation_refunded, record_manual_payment, reconcile_manual_payment, resolve_cancellation, review_card_transfer, submit_card_transfer


class BookingCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_write"
    serializer_class = BookingCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            booking = serializer.save()
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class BookingQuoteView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_quote"
    serializer_class = BookingQuoteSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            quote = serializer.save()
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        payload = {key: str(value) if hasattr(value, "as_tuple") else value for key, value in quote.items()}
        return Response(payload)


class MyBookingListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookingSerializer

    def get_queryset(self):
        expire_stale_bookings()
        return Booking.objects.filter(guest=self.request.user).select_related("villa", "villa__city").prefetch_related("villa__images", "payments", "cancellation_requests")


class MyBookingDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookingSerializer
    lookup_field = "code"

    def get_queryset(self):
        expire_stale_bookings()
        return Booking.objects.filter(guest=self.request.user).select_related("villa", "villa__city").prefetch_related("villa__images", "payments", "cancellation_requests")


class CustomerNotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerNotificationSerializer

    def get_queryset(self):
        return CustomerNotification.objects.filter(user=self.request.user).select_related("booking")


class CustomerNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        notification = generics.get_object_or_404(CustomerNotification, pk=pk, user=request.user)
        if not notification.read_at:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(CustomerNotificationSerializer(notification).data)


class CancellationRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CancellationRequestSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_write"

    def perform_create(self, serializer):
        booking = generics.get_object_or_404(Booking, code=self.kwargs["code"], guest=self.request.user)
        if booking.status in (Booking.Status.CANCELLED, Booking.Status.COMPLETED):
            raise ValidationError("برای این رزرو امکان ثبت درخواست لغو وجود ندارد.")
        if booking.cancellation_requests.filter(status=CancellationRequest.Status.REQUESTED).exists():
            raise ValidationError("درخواست لغو این رزرو قبلاً ثبت شده است.")
        quote = cancellation_quote(booking)
        serializer.save(
            booking=booking,
            refund_percentage=quote["refund_percentage"],
            estimated_refund_amount=quote["estimated_refund_amount"],
        )


class PaymentInitiateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_write"

    def post(self, request, *args, **kwargs):
        from django.conf import settings
        if not settings.PAYMENT_MOCK_ENABLED:
            return Response({"detail": "پرداخت آنلاین هنوز فعال نشده است؛ تیم پشتیبانی برای پرداخت با شما تماس می‌گیرد."}, status=status.HTTP_404_NOT_FOUND)
        booking = generics.get_object_or_404(Booking, code=self.kwargs["code"], guest=request.user)
        try:
            payment = initiate_payment(booking=booking)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response({"payment": PaymentSerializer(payment).data, "mode": "local_mock"}, status=status.HTTP_201_CREATED)


class MockPaymentCompleteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MockPaymentResultSerializer

    def post(self, request, *args, **kwargs):
        from django.conf import settings
        if not settings.PAYMENT_MOCK_ENABLED:
            return Response({"detail": "مسیر پرداخت آزمایشی فعال نیست."}, status=status.HTTP_404_NOT_FOUND)
        payment = generics.get_object_or_404(Payment, authority=self.kwargs["authority"], booking__guest=request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = complete_mock_payment(payment=payment, success=serializer.validated_data["result"] == "paid")
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        payment.booking.refresh_from_db()
        return Response({"payment": PaymentSerializer(payment).data, "booking": BookingSerializer(payment.booking).data})


class CardTransferInstructionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code):
        expire_stale_bookings()
        booking = generics.get_object_or_404(Booking, code=code, guest=request.user)
        try:
            return Response(card_transfer_instructions(booking))
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)


class CardTransferSubmitView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CardTransferSubmitSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_write"

    def post(self, request, code):
        booking = generics.get_object_or_404(Booking, code=code, guest=request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = submit_card_transfer(booking=booking, **serializer.validated_data)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class CardTransferProofView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code, pk):
        payment = generics.get_object_or_404(Payment, pk=pk, booking__code=code, booking__guest=request.user, gateway=Payment.Gateway.CARD_TO_CARD)
        if not payment.proof_image:
            return Response({"detail": "تصویر رسید موجود نیست."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(payment.proof_image.open("rb"), content_type="image/*")


class AdminCardTransferPaymentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminCardTransferPaymentListView(generics.ListAPIView):
    permission_classes = [IsFinanceOperationsAdmin]
    serializer_class = AdminCardTransferPaymentSerializer
    pagination_class = AdminCardTransferPaymentPagination

    def get_queryset(self):
        queryset = Payment.objects.filter(gateway=Payment.Gateway.CARD_TO_CARD).select_related("booking", "booking__guest", "booking__villa", "booking__villa__city", "reviewed_by").prefetch_related("booking__service_items")
        status_filter = self.request.query_params.get("status", "pending")
        allowed_statuses = {"all", Payment.Status.PENDING, Payment.Status.PAID, Payment.Status.FAILED}
        if status_filter not in allowed_statuses:
            raise ValidationError({"status": "فیلتر وضعیت معتبر نیست."})
        if status_filter != "all":
            queryset = queryset.filter(status=status_filter)
        query = self.request.query_params.get("q", "").strip()
        if len(query) > 120:
            raise ValidationError({"q": "عبارت جست‌وجو خیلی طولانی است."})
        if query:
            queryset = queryset.filter(Q(booking__code__icontains=query) | Q(booking__villa__title__icontains=query) | Q(booking__guest__phone__icontains=query) | Q(booking__guest__first_name__icontains=query) | Q(booking__guest__last_name__icontains=query) | Q(reference_id__icontains=query))
        return queryset.order_by(Case(When(status=Payment.Status.PENDING, then=Value(0)), default=Value(1), output_field=IntegerField()), "booking__expires_at", "-submitted_at", "-id")


class AdminCardTransferReviewView(generics.GenericAPIView):
    permission_classes = [IsFinanceOperationsAdmin]
    serializer_class = PaymentReviewSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def post(self, request, pk):
        payment = generics.get_object_or_404(Payment, pk=pk, gateway=Payment.Gateway.CARD_TO_CARD)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = review_card_transfer(payment=payment, admin_user=request.user, approve=serializer.validated_data["action"] == "approve", review_note=serializer.validated_data.get("review_note", ""))
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(PaymentSerializer(payment).data)


class AdminCardTransferProofView(APIView):
    permission_classes = [IsFinanceOperationsAdmin]

    def get(self, request, pk):
        payment = generics.get_object_or_404(Payment, pk=pk, gateway=Payment.Gateway.CARD_TO_CARD)
        if not payment.proof_image:
            return Response({"detail": "تصویر رسید موجود نیست."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(payment.proof_image.open("rb"), content_type="image/*")


class SupportTicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SupportTicketSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "support_write"

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user).select_related("booking")


class BookingReviewCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReviewSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_write"

    def perform_create(self, serializer):
        booking = generics.get_object_or_404(Booking, code=self.kwargs["code"], guest=self.request.user)
        if booking.status != Booking.Status.COMPLETED:
            raise ValidationError("ثبت نظر فقط پس از تکمیل اقامت امکان‌پذیر است.")
        if hasattr(booking, "review"):
            raise ValidationError("نظر این اقامت قبلاً ثبت شده است.")
        serializer.save(booking=booking, villa=booking.villa, guest=self.request.user)


class AdminBookingServiceListView(generics.ListAPIView):
    permission_classes = [IsBookingOperationsAdmin]
    serializer_class = AdminBookingServiceSerializer

    def get_queryset(self):
        queryset = BookingService.objects.select_related("service", "booking", "booking__villa", "booking__villa__city", "booking__guest")
        state = self.request.query_params.get("status", "")
        if state:
            queryset = queryset.filter(status=state)
        service = self.request.query_params.get("service", "")
        if service:
            queryset = queryset.filter(service__slug=service)
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(Q(booking__code__icontains=query) | Q(booking__guest__phone__icontains=query) | Q(title__icontains=query) | Q(booking__villa__title__icontains=query))
        return queryset.order_by("service_date", "created_at")


class AdminBookingServiceDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = AdminBookingServiceSerializer
    queryset = BookingService.objects.select_related("service", "booking", "booking__villa", "booking__villa__city", "booking__guest")
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def perform_update(self, serializer):
        previous = serializer.instance.status
        item = serializer.save()
        if item.status != previous:
            AdminAuditLog.objects.create(
                admin=self.request.user,
                action=f"booking_service.{item.status}",
                target_type="BookingService",
                target_id=str(item.pk),
                metadata={"booking_code": item.booking.code, "service": item.service.slug, "previous_status": previous},
            )


class AdminBookingListView(generics.ListAPIView):
    permission_classes = [IsBookingOperationsAdmin]
    serializer_class = BookingSerializer

    def get_queryset(self):
        queryset = Booking.objects.select_related("guest", "villa", "villa__city").prefetch_related("villa__images", "payments")
        booking_status = self.request.query_params.get("status")
        return queryset.filter(status=booking_status) if booking_status else queryset


class AdminBookingActionView(generics.GenericAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = BookingAdminActionSerializer
    queryset = Booking.objects.all()
    lookup_field = "code"
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def post(self, request, *args, **kwargs):
        booking = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            booking = decide_booking(
                booking=booking,
                admin_user=request.user,
                approve=serializer.validated_data["action"] == "approve",
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(BookingSerializer(booking).data)


class AdminPaymentReconcileView(APIView):
    permission_classes = [IsFinanceOperationsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def post(self, request, pk):
        payment = generics.get_object_or_404(Payment.objects.select_related("booking"), pk=pk, gateway=Payment.Gateway.MANUAL)
        try:
            payment = reconcile_manual_payment(payment=payment, admin_user=request.user)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(PaymentSerializer(payment).data)


class AdminManualPaymentRecordView(generics.GenericAPIView):
    permission_classes = [IsFinanceOperationsAdmin]
    serializer_class = ManualPaymentRecordSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def post(self, request, code):
        booking = generics.get_object_or_404(Booking, code=code)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = record_manual_payment(booking=booking, admin_user=request.user, amount=serializer.validated_data.get("amount"))
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class AdminCancellationListView(generics.ListAPIView):
    permission_classes = [IsFinanceOperationsAdmin]
    serializer_class = CancellationRequestSerializer

    def get_queryset(self):
        status_filter = self.request.query_params.get("status")
        queryset = CancellationRequest.objects.select_related("booking", "booking__villa", "booking__guest")
        return queryset.filter(status=status_filter) if status_filter else queryset


class AdminCancellationActionView(generics.GenericAPIView):
    permission_classes = [IsFinanceOperationsAdmin]
    serializer_class = AdminCancellationActionSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def post(self, request, pk):
        cancellation = generics.get_object_or_404(CancellationRequest, pk=pk)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            action = serializer.validated_data["action"]
            if action == "refunded":
                cancellation = mark_cancellation_refunded(cancellation_request=cancellation, admin_user=request.user)
            else:
                cancellation = resolve_cancellation(cancellation_request=cancellation, admin_user=request.user, approve=action == "approve", admin_note=serializer.validated_data.get("admin_note", ""))
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
        return Response(CancellationRequestSerializer(cancellation).data)


class AdminSupportTicketListView(generics.ListAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = AdminSupportTicketSerializer

    def get_queryset(self):
        status_filter = self.request.query_params.get("status")
        queryset = SupportTicket.objects.select_related("user", "booking")
        return queryset.filter(status=status_filter) if status_filter else queryset


class AdminSupportTicketUpdateView(generics.UpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = AdminSupportTicketSerializer
    queryset = SupportTicket.objects.select_related("user", "booking")
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def perform_update(self, serializer):
        ticket = serializer.save()
        from .models import AdminAuditLog
        from .services import notify_customer
        AdminAuditLog.objects.create(admin=self.request.user, action="support.updated", target_type="SupportTicket", target_id=str(ticket.pk), metadata={"status": ticket.status})
        notify_customer(user=ticket.user, booking=ticket.booking, kind="support_updated", title="پاسخ پشتیبانی ثبت شد", message=ticket.admin_response or "وضعیت درخواست پشتیبانی شما به‌روزرسانی شد.", metadata={"ticket_id": ticket.pk})


class AdminOperationsOverviewView(APIView):
    permission_classes = [IsBookingOperationsAdmin]

    def get(self, request):
        expire_stale_bookings()
        now = timezone.now()
        pending = Booking.objects.filter(status=Booking.Status.PENDING_OWNER)
        return Response({
            "pending_bookings": pending.count(),
            "expiring_holds": pending.filter(expires_at__gt=now, expires_at__lte=now + timedelta(minutes=30), deposit_paid_online=0).count(),
            "unpaid_bookings": pending.filter(deposit_paid_online=0).count(),
            "pending_transfer_receipts": Payment.objects.filter(gateway=Payment.Gateway.CARD_TO_CARD, status=Payment.Status.PENDING).count(),
            "pending_services": BookingService.objects.filter(status=BookingService.Status.REQUESTED, booking__status__in=[Booking.Status.PENDING_OWNER, Booking.Status.CONFIRMED]).count(),
            "expiring_transfer_reviews": Payment.objects.filter(gateway=Payment.Gateway.CARD_TO_CARD, status=Payment.Status.PENDING, booking__expires_at__gt=now, booking__expires_at__lte=now + timedelta(hours=2)).count(),
            "open_support_tickets": SupportTicket.objects.exclude(status=SupportTicket.Status.CLOSED).count(),
            "open_cancellations": CancellationRequest.objects.filter(status=CancellationRequest.Status.REQUESTED).count(),
            "unassigned_leads": Inquiry.objects.filter(kind=Inquiry.Kind.CONTRACTOR, assigned_contractor__isnull=True).exclude(status=Inquiry.Status.CLOSED).count(),
            "overdue_follow_ups": Inquiry.objects.filter(follow_up_at__lt=now).exclude(status=Inquiry.Status.CLOSED).count(),
            "blocked_days": Availability.objects.filter(status=Availability.Status.BLOCKED, date__gte=timezone.localdate()).count(),
            "paid_total": str(Payment.objects.filter(status=Payment.Status.PAID).aggregate(total=Sum("amount"))["total"] or 0),
            "recent_bookings": BookingSerializer(Booking.objects.select_related("villa", "villa__city").prefetch_related("villa__images", "payments").order_by("-created_at")[:8], many=True).data,
        })


class AdminSystemStatusView(APIView):
    permission_classes = [IsBookingOperationsAdmin]

    def get(self, request):
        runs = {
            row.task_name: {
                "status": row.status,
                "started_at": row.started_at,
                "finished_at": row.finished_at,
                "duration_ms": row.duration_ms,
                "processed_count": row.processed_count,
                "error_summary": row.error_summary,
                "details": row.details,
            }
            for row in OperationalTaskRun.objects.all()
        }
        housekeeping = OperationalTaskRun.objects.filter(task_name="process_operational_tasks").first()
        stale = not housekeeping or not housekeeping.finished_at or housekeeping.finished_at < timezone.now() - timedelta(minutes=3)
        return Response({
            "status": "degraded" if stale or any(row["status"] == OperationalTaskRun.Status.FAILED for row in runs.values()) else "ok",
            "scheduler_stale": stale,
            "tasks": runs,
        })


class AdminAuditPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminAuditLogListView(generics.ListAPIView):
    permission_classes = [IsBookingOperationsAdmin]
    serializer_class = AdminAuditLogSerializer
    pagination_class = AdminAuditPagination
    queryset = AdminAuditLog.objects.select_related("admin").all()
