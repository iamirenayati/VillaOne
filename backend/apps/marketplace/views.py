from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsContentOperationsAdmin
from apps.bookings.models import AdminAuditLog, Booking, BookingService
from apps.villas.models import Villa
from .models import Article, BusinessSettings, Contractor, Inquiry, RealEstateListing, ServiceAvailability, ServiceOffer
from .serializers import ArticleSerializer, BusinessSettingsSerializer, ContractorAdminSerializer, ContractorSerializer, InquiryAdminSerializer, InquirySerializer, RealEstateSerializer, ServiceAdminSerializer, ServiceSerializer


class BusinessSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = BusinessSettingsSerializer

    def get_permissions(self):
        return [permissions.AllowAny()] if self.request.method == "GET" else [IsContentOperationsAdmin()]

    def get_object(self):
        existing = BusinessSettings.objects.filter(pk=1).first()
        if existing:
            return existing
        if self.request.method == "GET":
            return BusinessSettings(pk=1, brand_name="ویلاوان")
        return BusinessSettings.objects.create(pk=1, brand_name="ویلاوان")

    def perform_update(self, serializer):
        settings = serializer.save()
        AdminAuditLog.objects.create(admin=self.request.user, action="business_settings.updated", target_type="BusinessSettings", target_id=str(settings.pk))


class RealEstateListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RealEstateSerializer

    def get_queryset(self):
        queryset = RealEstateListing.objects.filter(status=RealEstateListing.Status.PUBLISHED)
        if self.request.query_params.get("city"):
            queryset = queryset.filter(city=self.request.query_params["city"])
        return queryset


class RealEstateDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RealEstateSerializer
    lookup_field = "slug"
    queryset = RealEstateListing.objects.filter(status=RealEstateListing.Status.PUBLISHED)


class ContractorListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ContractorSerializer
    queryset = Contractor.objects.filter(status=Contractor.Status.PUBLISHED)


class ContractorDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ContractorSerializer
    lookup_field = "slug"
    queryset = Contractor.objects.filter(status=Contractor.Status.PUBLISHED)


class ArticleListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArticleSerializer

    def get_queryset(self):
        queryset = Article.objects.filter(
            status=Article.Status.PUBLISHED,
            published_at__lte=timezone.now(),
        ).prefetch_related("inline_images")
        category = self.request.query_params.get("category", "").strip()
        if category:
            valid_categories = {choice.value for choice in Article.Category}
            if category not in valid_categories:
                raise ValidationError({"category": "دسته‌بندی مقاله معتبر نیست."})
            queryset = queryset.filter(category=category)
        return queryset


class ArticleDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArticleSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Article.objects.filter(
            status=Article.Status.PUBLISHED,
            published_at__lte=timezone.now(),
        ).prefetch_related("inline_images")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["detail"] = True
        return context


class ServiceListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ServiceSerializer
    queryset = ServiceOffer.objects.filter(status=ServiceOffer.Status.PUBLISHED).prefetch_related("images")


class ServiceDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ServiceSerializer
    lookup_field = "slug"
    queryset = ServiceOffer.objects.filter(status=ServiceOffer.Status.PUBLISHED).prefetch_related("images")


class EligibleServiceListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ServiceSerializer

    def get_queryset(self):
        villa = get_object_or_404(Villa, slug=self.request.query_params.get("villa", ""), status=Villa.Status.PUBLISHED)
        return ServiceOffer.objects.filter(
            status=ServiceOffer.Status.PUBLISHED,
            fulfillment_mode__in=[ServiceOffer.FulfillmentMode.BOOKABLE, ServiceOffer.FulfillmentMode.BOTH],
        ).filter(Q(eligible_villas__isnull=True) | Q(eligible_villas=villa)).prefetch_related("images").distinct()


class AdminServiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = ServiceAdminSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def get_queryset(self):
        queryset = ServiceOffer.objects.annotate(reservation_count=Count("booking_items", distinct=True)).prefetch_related("images", "eligible_villas")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(Q(title__icontains=query) | Q(category__icontains=query))
        return queryset

    def perform_create(self, serializer):
        service = serializer.save()
        AdminAuditLog.objects.create(admin=self.request.user, action="service.created", target_type="ServiceOffer", target_id=str(service.pk), metadata={"slug": service.slug})


class AdminServiceDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = ServiceAdminSerializer
    lookup_field = "slug"
    queryset = ServiceOffer.objects.annotate(reservation_count=Count("booking_items", distinct=True)).prefetch_related("images", "eligible_villas")
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def perform_update(self, serializer):
        service = serializer.save()
        AdminAuditLog.objects.create(admin=self.request.user, action="service.updated", target_type="ServiceOffer", target_id=str(service.pk), metadata={"slug": service.slug, "status": service.status})


class AdminServiceAvailabilityView(APIView):
    permission_classes = [IsContentOperationsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def get_service(self, slug):
        return get_object_or_404(ServiceOffer, slug=slug)

    def get(self, request, slug):
        service = self.get_service(slug)
        start = parse_date(request.query_params.get("start", "")) or timezone.localdate()
        try:
            days_count = min(90, max(1, int(request.query_params.get("days", 30))))
        except ValueError:
            days_count = 30
        end = start + timedelta(days=days_count)
        rows = {row.date: row for row in ServiceAvailability.objects.filter(service=service, date__gte=start, date__lt=end)}
        reservations = dict(
            BookingService.objects.filter(service=service, service_date__gte=start, service_date__lt=end, booking__status__in=[Booking.Status.PENDING_OWNER, Booking.Status.CONFIRMED])
            .exclude(status__in=[BookingService.Status.UNAVAILABLE, BookingService.Status.CANCELLED])
            .values_list("service_date").annotate(total=Count("id"))
        )
        payload = []
        for offset in range(days_count):
            current = start + timedelta(days=offset)
            row = rows.get(current)
            payload.append({
                "date": current.isoformat(),
                "status": row.status if row else ServiceAvailability.Status.AVAILABLE,
                "capacity": row.capacity_override if row and row.capacity_override is not None else service.default_daily_capacity,
                "capacity_override": row.capacity_override if row else None,
                "price_override": str(row.price_override) if row and row.price_override is not None else None,
                "reserved": reservations.get(current, 0),
                "admin_note": row.admin_note if row else "",
            })
        return Response({"service": service.slug, "days": payload})

    @transaction.atomic
    def patch(self, request, slug):
        service = self.get_service(slug)
        dates = [parse_date(value) for value in request.data.get("dates", [])]
        if not dates or any(value is None for value in dates) or len(dates) > 90:
            return Response({"dates": "بین ۱ تا ۹۰ تاریخ معتبر ارسال کنید."}, status=400)
        state = request.data.get("status", ServiceAvailability.Status.AVAILABLE)
        if state not in ServiceAvailability.Status.values:
            return Response({"status": "وضعیت تقویم معتبر نیست."}, status=400)
        active_dates = set(BookingService.objects.filter(
            service=service,
            service_date__in=dates,
            booking__status__in=[Booking.Status.PENDING_OWNER, Booking.Status.CONFIRMED],
        ).exclude(status__in=[BookingService.Status.UNAVAILABLE, BookingService.Status.CANCELLED]).values_list("service_date", flat=True))
        if state != ServiceAvailability.Status.AVAILABLE and active_dates:
            return Response({"detail": "روز دارای رزرو فعال را نمی‌توان مسدود کرد.", "dates": sorted(value.isoformat() for value in active_dates)}, status=409)
        capacity = request.data.get("capacity_override")
        price = request.data.get("price_override")
        note = str(request.data.get("admin_note", ""))[:300]
        for current in dates:
            ServiceAvailability.objects.update_or_create(service=service, date=current, defaults={"status": state, "capacity_override": capacity, "price_override": price, "admin_note": note})
        AdminAuditLog.objects.create(admin=request.user, action="service.availability_updated", target_type="ServiceOffer", target_id=str(service.pk), metadata={"slug": service.slug, "dates": [value.isoformat() for value in dates], "status": state})
        return Response({"updated": len(dates)})


class InquiryCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = InquirySerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "inquiry_write"


class AdminContractorListView(generics.ListAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = ContractorAdminSerializer

    def get_queryset(self):
        queryset = Contractor.objects.annotate(inquiry_count=Count("inquiries", distinct=True))
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(name__icontains=query) | queryset.filter(city__icontains=query) | queryset.filter(specialty__icontains=query)
        return queryset.order_by("-featured", "-verified", "name")


class AdminContractorUpdateView(generics.UpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = ContractorAdminSerializer
    queryset = Contractor.objects.all()
    lookup_field = "slug"
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def perform_update(self, serializer):
        contractor = serializer.save()
        AdminAuditLog.objects.create(admin=self.request.user, action="contractor.updated", target_type="Contractor", target_id=str(contractor.pk), metadata={"slug": contractor.slug, "status": contractor.status})


class AdminInquiryListView(generics.ListAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = InquiryAdminSerializer
    queryset = Inquiry.objects.select_related("real_estate", "contractor", "service", "assigned_contractor").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        kind = self.request.query_params.get("kind")
        return queryset.filter(kind=kind) if kind else queryset


class AdminInquiryUpdateView(generics.UpdateAPIView):
    permission_classes = [IsContentOperationsAdmin]
    serializer_class = InquiryAdminSerializer
    queryset = Inquiry.objects.select_related("real_estate", "contractor", "service", "assigned_contractor").all()
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_write"

    def perform_update(self, serializer):
        inquiry = serializer.save()
        AdminAuditLog.objects.create(admin=self.request.user, action="inquiry.updated", target_type="Inquiry", target_id=str(inquiry.pk), metadata={"kind": inquiry.kind, "status": inquiry.status, "assigned_contractor": inquiry.assigned_contractor_id})
