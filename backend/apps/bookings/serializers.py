from rest_framework import serializers

from apps.villas.models import Villa
from apps.villas.serializers import VillaListSerializer
from .models import AdminAuditLog, Booking, BookingService, CancellationRequest, CustomerNotification, Payment, Review, SupportTicket
from .services import cancellation_quote, create_booking, quote_booking


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "gateway", "amount", "status", "authority", "reference_id", "submitted_at", "reviewed_at", "review_note", "attempt_number", "created_at")


class CustomerNotificationSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source="booking.code", read_only=True, allow_null=True)

    class Meta:
        model = CustomerNotification
        fields = ("id", "kind", "title", "message", "booking_code", "metadata", "read_at", "created_at")
        read_only_fields = fields


class CardTransferSubmitSerializer(serializers.Serializer):
    proof_image = serializers.ImageField()
    reference_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    client_request_id = serializers.CharField(required=False, allow_blank=True, max_length=80)

    def validate_proof_image(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("حجم تصویر رسید نباید بیشتر از ۵ مگابایت باشد.")
        if value.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise serializers.ValidationError("فقط تصویر JPEG، PNG یا WebP قابل ارسال است.")
        return value


class PaymentReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject"))
    review_note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs["action"] == "reject" and not attrs.get("review_note", "").strip():
            raise serializers.ValidationError({"review_note": "برای رد رسید، دلیل را وارد کنید."})
        return attrs


class AdminCardTransferPaymentSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source="booking.code", read_only=True)
    booking_status = serializers.CharField(source="booking.status", read_only=True)
    villa = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    stay = serializers.SerializerMethodField()
    financials = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()
    hold_expires_at = serializers.DateTimeField(source="booking.expires_at", read_only=True)
    reviewer = serializers.SerializerMethodField()
    proof_available = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id", "gateway", "amount", "status", "reference_id", "submitted_at", "reviewed_at", "review_note", "attempt_number",
            "booking_code", "booking_status", "villa", "customer", "stay", "financials", "services", "hold_expires_at", "reviewer", "proof_available",
        )

    def get_villa(self, obj):
        return {"slug": obj.booking.villa.slug, "title": obj.booking.villa.title, "city": obj.booking.villa.city.name}

    def get_customer(self, obj):
        guest = obj.booking.guest
        return {"name": guest.get_full_name() or guest.phone, "phone": guest.phone}

    def get_stay(self, obj):
        return {"checkin": obj.booking.checkin, "checkout": obj.booking.checkout, "guests_count": obj.booking.guests_count}

    def get_financials(self, obj):
        booking = obj.booking
        return {"total_price": str(booking.total_price), "amount_due_now": str(booking.amount_due_now), "paid": str(booking.deposit_paid_online), "remaining": str(booking.remaining_amount), "payment_plan": booking.payment_plan}

    def get_services(self, obj):
        return [{"title": row.title, "quantity": row.quantity, "total_price": str(row.total_price)} for row in obj.booking.service_items.all()]

    def get_reviewer(self, obj):
        if not obj.reviewed_by:
            return None
        return {"name": obj.reviewed_by.get_full_name() or obj.reviewed_by.phone, "role": obj.reviewed_by.role}

    def get_proof_available(self, obj):
        return bool(obj.proof_image)


class ReviewSerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "rating", "title", "comment", "status", "guest_name", "created_at")
        read_only_fields = ("status", "guest_name", "created_at")

    def get_guest_name(self, obj):
        return obj.guest.first_name or "مهمان ویلاوان"

    def validate_comment(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError("نظر شما باید دست‌کم ۱۰ نویسه داشته باشد.")
        return value


class BookingSerializer(serializers.ModelSerializer):
    villa = VillaListSerializer(read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    cancellation_status = serializers.SerializerMethodField()
    review = ReviewSerializer(read_only=True)
    cancellation_quote = serializers.SerializerMethodField()
    service_items = serializers.SerializerMethodField()

    def get_cancellation_status(self, obj):
        request = obj.cancellation_requests.first()
        return request.status if request else None

    def get_cancellation_quote(self, obj):
        quote = cancellation_quote(obj)
        return {**quote, "estimated_refund_amount": str(quote["estimated_refund_amount"])}

    def get_service_items(self, obj):
        return [{
            "id": item.id,
            "slug": item.service.slug,
            "title": item.title,
            "unit_price": str(item.unit_price),
            "quantity": item.quantity,
            "total_price": str(item.total_price),
            "pricing_model": item.pricing_model,
            "unit_label": item.unit_label,
            "service_date": item.service_date.isoformat() if item.service_date else None,
            "time_slot": item.time_slot,
            "customer_note": item.customer_note,
            "status": item.status,
        } for item in obj.service_items.select_related("service").all()]

    class Meta:
        model = Booking
        fields = (
            "id", "code", "villa", "checkin", "checkout", "guests_count", "stay_total", "services_total", "total_price", "service_items",
            "payment_plan", "amount_due_now", "deposit_paid_online", "remaining_amount", "remaining_payment_method", "status",
            "guest_note", "payments", "cancellation_status", "cancellation_quote", "refund_amount", "review", "expires_at", "created_at", "updated_at",
        )


class CancellationRequestSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source="booking.code", read_only=True)
    villa_title = serializers.CharField(source="booking.villa.title", read_only=True)
    customer = serializers.SerializerMethodField()

    class Meta:
        model = CancellationRequest
        fields = ("id", "booking", "booking_code", "villa_title", "customer", "reason", "status", "refund_percentage", "estimated_refund_amount", "admin_note", "requested_at", "resolved_at")
        read_only_fields = ("booking", "booking_code", "villa_title", "customer", "status", "refund_percentage", "estimated_refund_amount", "admin_note", "requested_at", "resolved_at")

    def get_customer(self, obj):
        user = obj.booking.guest
        return {"name": user.get_full_name() or user.phone, "phone": user.phone}

    def validate_reason(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError("دلیل لغو را کمی کامل‌تر بنویسید.")
        return value


class BookingServiceSelectionSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    quantity = serializers.IntegerField(min_value=1, max_value=20, required=False, default=1)
    service_date = serializers.DateField(required=False, allow_null=True)
    time_slot = serializers.ChoiceField(
        choices=("breakfast", "lunch", "dinner", "morning", "afternoon", "evening", "flexible"),
        required=False,
        allow_blank=True,
        default="",
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")


class BookingCreateSerializer(serializers.Serializer):
    villa_slug = serializers.SlugField()
    checkin = serializers.DateField()
    checkout = serializers.DateField()
    guests_count = serializers.IntegerField(min_value=1)
    payment_type = serializers.ChoiceField(choices=("deposit", "full"), default="deposit")
    guest_note = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    service_slugs = serializers.ListField(child=serializers.SlugField(), required=False, allow_empty=True, default=list)
    service_items = BookingServiceSelectionSerializer(many=True, required=False, allow_empty=True, default=list)
    client_request_id = serializers.CharField(required=False, allow_blank=True, max_length=80)

    def validate(self, attrs):
        if attrs.get("service_slugs") and attrs.get("service_items"):
            raise serializers.ValidationError({"service_items": "خدمات را فقط با یکی از قالب‌های پشتیبانی‌شده ارسال کنید."})
        return attrs

    def validate_villa_slug(self, value):
        try:
            return Villa.objects.get(slug=value, status=Villa.Status.PUBLISHED)
        except Villa.DoesNotExist as exc:
            raise serializers.ValidationError("ویلا پیدا نشد.") from exc

    def create(self, validated_data):
        return create_booking(
            guest=self.context["request"].user,
            villa=validated_data["villa_slug"],
            checkin=validated_data["checkin"],
            checkout=validated_data["checkout"],
            guests_count=validated_data["guests_count"],
            payment_type=validated_data["payment_type"],
            guest_note=validated_data.get("guest_note", ""),
            service_slugs=validated_data.get("service_slugs", []),
            service_items=validated_data.get("service_items", []),
            client_request_id=validated_data.get("client_request_id") or None,
        )


class BookingAdminActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject"))


class MockPaymentResultSerializer(serializers.Serializer):
    result = serializers.ChoiceField(choices=("paid", "failed"))


class ManualPaymentRecordSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=0, required=False, min_value=1)


class AdminBookingServiceSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(source="booking.code", read_only=True)
    booking_status = serializers.CharField(source="booking.status", read_only=True)
    villa = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    stay = serializers.SerializerMethodField()
    service_slug = serializers.CharField(source="service.slug", read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = BookingService
        fields = (
            "id", "booking_code", "booking_status", "villa", "customer", "stay", "service_slug", "title", "unit_price", "quantity", "total_price",
            "pricing_model", "unit_label", "service_date", "time_slot", "customer_note", "status", "admin_note", "created_at",
        )
        read_only_fields = (
            "id", "booking_code", "booking_status", "villa", "customer", "stay", "service_slug", "title", "unit_price", "quantity", "total_price",
            "pricing_model", "unit_label", "service_date", "time_slot", "customer_note", "created_at",
        )

    def get_villa(self, obj):
        return {"slug": obj.booking.villa.slug, "title": obj.booking.villa.title, "city": obj.booking.villa.city.name}

    def get_customer(self, obj):
        guest = obj.booking.guest
        return {"name": guest.get_full_name() or guest.phone, "phone": guest.phone}

    def get_stay(self, obj):
        return {"checkin": obj.booking.checkin, "checkout": obj.booking.checkout, "guests_count": obj.booking.guests_count}

    def get_total_price(self, obj):
        return str(obj.total_price)

    def validate_status(self, value):
        if not self.instance or value == self.instance.status:
            return value
        transitions = {
            BookingService.Status.REQUESTED: {BookingService.Status.CONFIRMED, BookingService.Status.UNAVAILABLE, BookingService.Status.CANCELLED},
            BookingService.Status.CONFIRMED: {BookingService.Status.COMPLETED, BookingService.Status.CANCELLED},
            BookingService.Status.UNAVAILABLE: set(),
            BookingService.Status.COMPLETED: set(),
            BookingService.Status.CANCELLED: set(),
        }
        if value not in transitions.get(self.instance.status, set()):
            raise serializers.ValidationError("تغییر وضعیت خدمت مجاز نیست.")
        if value in {BookingService.Status.UNAVAILABLE, BookingService.Status.CANCELLED} and self.instance.booking.deposit_paid_online > 0:
            raise serializers.ValidationError("خدمت پرداخت‌شده فقط از مسیر اصلاح مالی قابل لغو است.")
        return value


class AdminSupportTicketSerializer(serializers.ModelSerializer):
    customer = serializers.SerializerMethodField()
    booking_code = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = ("id", "customer", "booking_code", "category", "subject", "message", "status", "admin_response", "created_at", "updated_at")
        read_only_fields = ("id", "customer", "booking_code", "category", "subject", "message", "created_at", "updated_at")

    def get_customer(self, obj):
        return {"name": obj.user.get_full_name() or obj.user.phone, "phone": obj.user.phone}

    def get_booking_code(self, obj):
        return obj.booking.code if obj.booking else None


class AdminCancellationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject", "refunded"))
    admin_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = AdminAuditLog
        fields = ("id", "actor", "action", "target_type", "target_id", "metadata", "created_at")

    def get_actor(self, obj):
        if obj.admin_id is None:
            return {"name": obj.system_actor or "system", "phone": "", "role": "system"}
        return {"name": obj.admin.get_full_name() or obj.admin.phone, "phone": obj.admin.phone, "role": obj.admin.role}


class SupportTicketSerializer(serializers.ModelSerializer):
    booking_code = serializers.CharField(required=False, allow_blank=True, write_only=True)
    booking = serializers.SlugRelatedField(slug_field="code", read_only=True)

    class Meta:
        model = SupportTicket
        fields = ("id", "booking", "booking_code", "category", "subject", "message", "status", "admin_response", "created_at", "updated_at")
        read_only_fields = ("booking", "status", "admin_response", "created_at", "updated_at")

    def validate(self, attrs):
        code = attrs.pop("booking_code", "").strip()
        if code:
            try:
                attrs["booking"] = Booking.objects.get(code=code, guest=self.context["request"].user)
            except Booking.DoesNotExist as exc:
                raise serializers.ValidationError({"booking_code": "رزرو متعلق به این حساب پیدا نشد."}) from exc
        return attrs

    def create(self, validated_data):
        return SupportTicket.objects.create(user=self.context["request"].user, **validated_data)


class BookingQuoteSerializer(BookingCreateSerializer):
    def create(self, validated_data):
        return quote_booking(
            villa=validated_data["villa_slug"],
            checkin=validated_data["checkin"],
            checkout=validated_data["checkout"],
            guests_count=validated_data["guests_count"],
            payment_type=validated_data["payment_type"],
            service_slugs=validated_data.get("service_slugs", []),
            service_items=validated_data.get("service_items", []),
        )
