from django.contrib import admin
from django.contrib import messages
from django.core.exceptions import ValidationError
from .models import AdminAuditLog, Booking, BookingService, CancellationRequest, Payment, Review, SupportTicket
from .services import complete_booking, decide_booking, mark_cancellation_refunded, reconcile_manual_payment, resolve_cancellation


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("created_at", "updated_at")


class CancellationRequestInline(admin.TabularInline):
    model = CancellationRequest
    extra = 0
    readonly_fields = ("requested_at",)


class BookingServiceInline(admin.TabularInline):
    model = BookingService
    extra = 0
    fields = ("title", "unit_price", "quantity", "status", "admin_note")
    readonly_fields = ("title", "unit_price")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("code", "villa", "guest", "checkin", "checkout", "total_price", "payment_plan", "amount_due_now", "status", "created_at")
    list_filter = ("status", "checkin", "villa__city")
    search_fields = ("code", "guest__phone", "guest__first_name", "guest__last_name", "villa__title")
    readonly_fields = ("code", "status", "total_price", "amount_due_now", "deposit_paid_online", "remaining_amount", "refund_amount", "cancellation_policy_applied", "created_at", "updated_at")
    inlines = (PaymentInline, CancellationRequestInline, BookingServiceInline)
    actions = ("approve_bookings", "reject_bookings", "complete_bookings")

    @admin.action(description="ثبت اقامت‌های انتخاب‌شده به‌عنوان تکمیل‌شده")
    def complete_bookings(self, request, queryset):
        completed = 0
        for booking in queryset:
            try:
                complete_booking(booking=booking, admin_user=request.user)
                completed += 1
            except ValidationError as exc:
                self.message_user(request, f"{booking.code}: {' '.join(exc.messages)}", level=messages.ERROR)
        if completed:
            self.message_user(request, f"{completed} اقامت تکمیل شد.", level=messages.SUCCESS)

    @admin.action(description="تأیید رزرو و قفل‌کردن تقویم")
    def approve_bookings(self, request, queryset):
        self._decide_bookings(request, queryset, approve=True)

    @admin.action(description="رد رزروهای انتخاب‌شده")
    def reject_bookings(self, request, queryset):
        self._decide_bookings(request, queryset, approve=False)

    def _decide_bookings(self, request, queryset, *, approve):
        completed = 0
        for booking in queryset:
            try:
                decide_booking(booking=booking, admin_user=request.user, approve=approve)
                completed += 1
            except ValidationError as exc:
                self.message_user(request, f"{booking.code}: {' '.join(exc.messages)}", level=messages.ERROR)
        if completed:
            self.message_user(request, f"{completed} رزرو با موفقیت بررسی شد.", level=messages.SUCCESS)


@admin.register(CancellationRequest)
class CancellationRequestAdmin(admin.ModelAdmin):
    list_display = ("booking", "status", "refund_percentage", "estimated_refund_amount", "requested_at", "resolved_at")
    list_filter = ("status", "requested_at")
    search_fields = ("booking__code", "booking__guest__phone", "reason")
    readonly_fields = ("booking", "reason", "refund_percentage", "estimated_refund_amount", "requested_at")
    actions = ("approve_requests", "reject_requests", "mark_refunded")

    @admin.action(description="ثبت بازگشت وجه برای لغوهای انتخاب‌شده")
    def mark_refunded(self, request, queryset):
        completed = 0
        for cancellation in queryset:
            try:
                mark_cancellation_refunded(cancellation_request=cancellation, admin_user=request.user)
                completed += 1
            except ValidationError as exc:
                self.message_user(request, f"{cancellation}: {' '.join(exc.messages)}", level=messages.ERROR)
        if completed:
            self.message_user(request, f"بازگشت وجه {completed} درخواست ثبت شد.", level=messages.SUCCESS)

    @admin.action(description="تأیید لغو و آزادسازی تقویم")
    def approve_requests(self, request, queryset):
        self._resolve_requests(request, queryset, approve=True)

    @admin.action(description="رد درخواست لغو")
    def reject_requests(self, request, queryset):
        self._resolve_requests(request, queryset, approve=False)

    def _resolve_requests(self, request, queryset, *, approve):
        completed = 0
        for cancellation in queryset:
            try:
                resolve_cancellation(cancellation_request=cancellation, admin_user=request.user, approve=approve)
                completed += 1
            except ValidationError as exc:
                self.message_user(request, f"{cancellation}: {' '.join(exc.messages)}", level=messages.ERROR)
        if completed:
            self.message_user(request, f"{completed} درخواست با موفقیت بررسی شد.", level=messages.SUCCESS)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("booking", "gateway", "amount", "status", "reference_id", "created_at")
    list_filter = ("gateway", "status")
    search_fields = ("booking__code", "reference_id", "authority")
    readonly_fields = ("status", "raw_response", "created_at", "updated_at")
    actions = ("mark_paid_manually",)

    @admin.action(description="ثبت پرداخت‌های انتخاب‌شده به‌عنوان وصول‌شده")
    def mark_paid_manually(self, request, queryset):
        completed = 0
        for payment in queryset:
            try:
                reconcile_manual_payment(payment=payment, admin_user=request.user)
                completed += 1
            except ValidationError as exc:
                self.message_user(request, f"{payment}: {' '.join(exc.messages)}", level=messages.ERROR)
        if completed:
            self.message_user(request, f"{completed} پرداخت وصول شد.", level=messages.SUCCESS)


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "admin", "action", "target_type", "target_id")
    readonly_fields = ("admin", "action", "target_type", "target_id", "metadata", "created_at")
    search_fields = ("action", "target_type", "target_id", "admin__phone")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "user", "booking", "category", "status", "updated_at")
    list_filter = ("status", "category", "created_at")
    search_fields = ("subject", "message", "user__phone", "booking__code")
    readonly_fields = ("user", "booking", "category", "subject", "message", "created_at", "updated_at")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("booking", "villa", "guest", "rating", "status", "created_at")
    list_filter = ("status", "rating", "created_at")
    search_fields = ("booking__code", "villa__title", "guest__phone", "title", "comment")
    readonly_fields = ("booking", "villa", "guest", "rating", "title", "comment", "created_at", "updated_at")
    actions = ("approve_reviews", "reject_reviews")

    @admin.action(description="تأیید نظرهای انتخاب‌شده")
    def approve_reviews(self, request, queryset):
        queryset.update(status=Review.Status.APPROVED)

    @admin.action(description="رد نظرهای انتخاب‌شده")
    def reject_reviews(self, request, queryset):
        queryset.update(status=Review.Status.REJECTED)
