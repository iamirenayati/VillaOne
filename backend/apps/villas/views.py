from datetime import date, timedelta

from django.db.models import Avg, Count, Q
from rest_framework import generics, permissions, status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsContentOperationsAdmin
from apps.bookings.models import AdminAuditLog
from .models import Availability, City, Favorite, PriceOverride, Villa
from .serializers import AvailabilitySerializer, CitySerializer, PriceOverrideAdminSerializer, PublicReviewSerializer, VillaAdminUpdateSerializer, VillaDetailSerializer, VillaListSerializer, VillaMapSerializer


def published_villas():
    return Villa.objects.filter(status=Villa.Status.PUBLISHED).annotate(
        rating_average=Avg("reviews__rating", filter=Q(reviews__status="approved")),
        reviews_count=Count("reviews", filter=Q(reviews__status="approved")),
    )


class CityListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CitySerializer
    queryset = City.objects.filter(is_active=True)


class VillaListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VillaListSerializer

    def get_queryset(self):
        queryset = published_villas().select_related("city").prefetch_related("images")
        city = self.request.query_params.get("city")
        guests = self.request.query_params.get("guests")
        checkin = self.request.query_params.get("checkin")
        checkout = self.request.query_params.get("checkout")
        if city:
            city_filter = Q(city__name=city)
            if city.isdigit():
                city_filter |= Q(city_id=int(city))
            queryset = queryset.filter(city_filter)
        if guests:
            queryset = queryset.filter(capacity__gte=guests)
        if checkin and checkout:
            from apps.bookings.models import Booking
            from apps.bookings.services import active_booking_filter, expire_stale_bookings

            try:
                start, end = date.fromisoformat(checkin), date.fromisoformat(checkout)
            except ValueError as exc:
                raise ValidationError("تاریخ باید با قالب YYYY-MM-DD ارسال شود.") from exc
            blocked_villas = Availability.objects.filter(
                date__gte=start,
                date__lt=end,
                status__in=[Availability.Status.BLOCKED, Availability.Status.BOOKED],
            ).values_list("villa_id", flat=True)
            expire_stale_bookings()
            reserved_villas = Booking.objects.filter(
                checkin__lt=end,
                checkout__gt=start,
            ).filter(active_booking_filter()).values_list("villa_id", flat=True)
            queryset = queryset.exclude(id__in=blocked_villas).exclude(id__in=reserved_villas)
        return queryset


class VillaMapView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VillaMapSerializer
    queryset = (
        Villa.objects.filter(
            status=Villa.Status.PUBLISHED,
            latitude__isnull=False,
            longitude__isnull=False,
        )
        .select_related("city")
        .prefetch_related("images")
        .order_by("-featured", "title")
    )


class VillaDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VillaDetailSerializer
    lookup_field = "slug"
    queryset = published_villas().select_related("city").prefetch_related("amenities", "images")


class VillaReviewListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicReviewSerializer

    def get_queryset(self):
        from apps.bookings.models import Review

        return Review.objects.filter(
            villa__slug=self.kwargs["slug"],
            villa__status=Villa.Status.PUBLISHED,
            status=Review.Status.APPROVED,
        ).select_related("guest")


class VillaAvailabilityView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AvailabilitySerializer

    def get_queryset(self):
        from apps.bookings.models import Booking
        from apps.bookings.services import active_booking_filter, expire_stale_bookings

        self.villa = generics.get_object_or_404(Villa, slug=self.kwargs["slug"], status=Villa.Status.PUBLISHED)
        start = date.fromisoformat(self.request.query_params.get("start", date.today().isoformat()))
        end = date.fromisoformat(self.request.query_params.get("end", (start + timedelta(days=60)).isoformat()))
        if end <= start or (end - start).days > 180:
            raise ValidationError("بازه تقویم باید بین ۱ تا ۱۸۰ روز باشد.")
        existing = {item.date: item for item in Availability.objects.filter(villa=self.villa, date__gte=start, date__lt=end)}
        reserved_dates = set()
        expire_stale_bookings()
        for booking in Booking.objects.filter(
            villa=self.villa,
            checkin__lt=end,
            checkout__gt=start,
        ).filter(active_booking_filter()):
            overlap_start = max(start, booking.checkin)
            overlap_end = min(end, booking.checkout)
            reserved_dates.update(overlap_start + timedelta(days=offset) for offset in range((overlap_end - overlap_start).days))
        rows = []
        for offset in range((end - start).days):
            current = start + timedelta(days=offset)
            rows.append(
                Availability(villa=self.villa, date=current, status=Availability.Status.BOOKED, note="رزرو فعال")
                if current in reserved_dates else existing.get(current) or Availability(villa=self.villa, date=current, status=Availability.Status.OPEN)
            )
        return rows

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if hasattr(self, "villa"):
            context["overrides"] = {item.date: item for item in PriceOverride.objects.filter(villa=self.villa)}
        return context


class AvailabilityAdminUpdateView(APIView):
    """Create or update a manual availability override for one villa day."""

    permission_classes = [IsContentOperationsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def patch(self, request, slug, day):
        villa = generics.get_object_or_404(Villa, slug=slug)
        try:
            target = date.fromisoformat(day)
        except ValueError as exc:
            raise ValidationError("تاریخ باید با قالب YYYY-MM-DD ارسال شود.") from exc
        from apps.bookings.models import Booking
        from apps.bookings.services import active_booking_filter

        value = request.data.get("status")
        allowed = {Availability.Status.OPEN, Availability.Status.BLOCKED}
        if value not in allowed:
            raise ValidationError({"status": "وضعیت دستی فقط می‌تواند open یا blocked باشد؛ booked فقط از رزرو واقعی ایجاد می‌شود."})
        if Booking.objects.filter(villa=villa, checkin__lte=target, checkout__gt=target).filter(active_booking_filter()).exists():
            raise ValidationError("این روز به یک رزرو فعال تعلق دارد و قابل ویرایش دستی نیست.")
        item, _ = Availability.objects.update_or_create(
            villa=villa,
            date=target,
            defaults={"status": value, "note": request.data.get("note", "")},
        )
        AdminAuditLog.objects.create(admin=request.user, action="availability.updated", target_type="Availability", target_id=f"{villa.pk}:{target}", metadata={"villa": villa.slug, "status": value})
        return Response(AvailabilitySerializer(item).data)


class VillaAdminListView(generics.ListAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = VillaAdminUpdateSerializer
    queryset = Villa.objects.select_related("city").prefetch_related("images").all()


class VillaAdminUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = VillaAdminUpdateSerializer
    queryset = Villa.objects.select_related("city").prefetch_related("images").all()
    lookup_field = "slug"
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def perform_update(self, serializer):
        villa = serializer.save()
        AdminAuditLog.objects.create(admin=self.request.user, action="villa.updated", target_type="Villa", target_id=str(villa.pk), metadata={"villa": villa.slug})


class AvailabilityAdminBulkUpdateView(APIView):
    permission_classes = [IsContentOperationsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def post(self, request, slug):
        villa = generics.get_object_or_404(Villa, slug=slug)
        days = request.data.get("days", [])
        value = request.data.get("status")
        if not isinstance(days, list) or not days or value not in {Availability.Status.OPEN, Availability.Status.BLOCKED}:
            raise ValidationError("روزها و وضعیت معتبر ارسال کنید.")
        from apps.bookings.models import Booking
        from apps.bookings.services import active_booking_filter

        parsed_days = []
        for day in days:
            try:
                target = date.fromisoformat(day)
            except (TypeError, ValueError) as exc:
                raise ValidationError("تاریخ باید با قالب YYYY-MM-DD باشد.") from exc
            if Booking.objects.filter(villa=villa, checkin__lte=target, checkout__gt=target).filter(active_booking_filter()).exists():
                raise ValidationError("بازه انتخاب‌شده شامل روز دارای رزرو فعال است.")
            parsed_days.append(target)
        for target in parsed_days:
            Availability.objects.update_or_create(villa=villa, date=target, defaults={"status": value, "note": request.data.get("note", "")})
        AdminAuditLog.objects.create(admin=request.user, action="availability.bulk_updated", target_type="Villa", target_id=str(villa.pk), metadata={"villa": villa.slug, "days": [str(day) for day in parsed_days], "status": value})
        return Response({"updated": len(days), "status": value})


class PriceOverrideAdminUpdateView(generics.UpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = PriceOverrideAdminSerializer
    lookup_field = "date"
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def get_queryset(self):
        villa = generics.get_object_or_404(Villa, slug=self.kwargs["slug"])
        return PriceOverride.objects.filter(villa=villa)

    def update(self, request, *args, **kwargs):
        villa = generics.get_object_or_404(Villa, slug=self.kwargs["slug"])
        try:
            target = date.fromisoformat(kwargs["date"])
        except (TypeError, ValueError) as exc:
            raise ValidationError("تاریخ باید با قالب YYYY-MM-DD باشد.") from exc
        serializer = self.get_serializer(data={"date": target, "price": request.data.get("price")})
        serializer.is_valid(raise_exception=True)
        item, _ = PriceOverride.objects.update_or_create(villa=villa, date=target, defaults={"price": serializer.validated_data["price"]})
        AdminAuditLog.objects.create(admin=request.user, action="price_override.updated", target_type="PriceOverride", target_id=f"{villa.pk}:{target}", metadata={"villa": villa.slug, "price": str(item.price)})
        return Response(self.get_serializer(item).data)


class FavoriteVillaListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VillaListSerializer

    def get_queryset(self):
        return published_villas().filter(
            status=Villa.Status.PUBLISHED,
            favorited_by__user=self.request.user,
        ).select_related("city").prefetch_related("images")


class FavoriteVillaToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        villa = generics.get_object_or_404(Villa, slug=slug, status=Villa.Status.PUBLISHED)
        favorite, created = Favorite.objects.get_or_create(user=request.user, villa=villa)
        if not created:
            favorite.delete()
        return Response({"slug": villa.slug, "saved": created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
