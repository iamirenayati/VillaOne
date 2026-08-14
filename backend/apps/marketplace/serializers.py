import re

from django.utils import timezone
from rest_framework import serializers
from apps.villas.models import Villa

from .article_rendering import reading_time_minutes, render_article_body
from .models import Article, ArticleImage, BusinessSettings, Contractor, Inquiry, RealEstateListing, ServiceImage, ServiceOffer


def with_uploaded_cover(instance, data, request=None):
    if instance.uploaded_cover_image:
        url = instance.uploaded_cover_image.url
        data["cover_image"] = request.build_absolute_uri(url) if request else url
    return data


class BusinessSettingsSerializer(serializers.ModelSerializer):
    launch_ready = serializers.BooleanField(source="is_launch_ready", read_only=True)

    class Meta:
        model = BusinessSettings
        fields = (
            "brand_name", "support_phone", "support_whatsapp", "operating_hours", "footer_description",
            "terms_text", "privacy_text", "cancellation_text", "launch_ready", "updated_at",
        )
        read_only_fields = ("launch_ready", "updated_at")


class RealEstateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RealEstateListing
        fields = ("id", "slug", "title", "city", "neighborhood", "property_type", "price", "area_m2", "bedrooms", "description", "features", "cover_image", "is_featured")

    def to_representation(self, instance):
        return with_uploaded_cover(instance, super().to_representation(instance), self.context.get("request"))


class ContractorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contractor
        fields = ("id", "slug", "name", "specialty", "city", "years_experience", "description", "services", "catalog", "cover_image", "verified", "featured")

    def to_representation(self, instance):
        return with_uploaded_cover(instance, super().to_representation(instance), self.context.get("request"))


class ContractorAdminSerializer(serializers.ModelSerializer):
    inquiry_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Contractor
        fields = ("id", "slug", "name", "specialty", "city", "years_experience", "description", "services", "catalog", "cover_image", "verified", "featured", "status", "inquiry_count")
        read_only_fields = ("id", "slug", "inquiry_count")

    def to_representation(self, instance):
        return with_uploaded_cover(instance, super().to_representation(instance), self.context.get("request"))


class ArticleSerializer(serializers.ModelSerializer):
    category_code = serializers.CharField(source="category", read_only=True)
    category = serializers.SerializerMethodField()
    body_html = serializers.SerializerMethodField()
    inline_images = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField(read_only=True)
    cta = serializers.SerializerMethodField()
    related_articles = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = (
            "id", "slug", "title", "excerpt", "body", "body_html", "category", "category_code", "author_name",
            "cover_image", "cover_alt", "published_at", "updated_at", "reading_time_minutes", "inline_images",
            "cta", "related_articles",
        )

    def to_representation(self, instance):
        return with_uploaded_cover(instance, super().to_representation(instance), self.context.get("request"))

    def get_category(self, obj):
        return obj.get_category_display()

    def get_body_html(self, obj):
        if not self.context.get("detail"):
            return None
        return render_article_body(obj, self.context.get("request"))

    def get_inline_images(self, obj):
        if not self.context.get("detail"):
            return []
        return ArticleImageSerializer(obj.inline_images.all(), many=True, context=self.context).data

    def get_reading_time_minutes(self, obj):
        return reading_time_minutes(obj.body)

    def get_cta(self, obj):
        if not obj.cta_label or not obj.cta_url:
            return None
        return {"label": obj.cta_label, "url": obj.cta_url}

    def get_related_articles(self, obj):
        if not self.context.get("detail"):
            return []
        base = Article.objects.filter(
            status=Article.Status.PUBLISHED,
            published_at__lte=timezone.now(),
        ).exclude(pk=obj.pk)
        related = list(base.filter(category=obj.category)[:3])
        if len(related) < 3:
            related.extend(list(base.exclude(pk__in=[item.pk for item in related]).order_by("-published_at", "-created_at")[: 3 - len(related)]))
        return RelatedArticleSerializer(related[:3], many=True, context=self.context).data


class ArticleImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ArticleImage
        fields = ("key", "url", "alt_text", "caption", "sort_order", "width", "height")

    def get_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class RelatedArticleSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = ("id", "slug", "title", "excerpt", "category", "cover_image", "published_at")

    def get_category(self, obj):
        return obj.get_category_display()

    def to_representation(self, instance):
        return with_uploaded_cover(instance, super().to_representation(instance), self.context.get("request"))


class ServiceImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceImage
        fields = ("id", "url", "alt_text", "sort_order")

    def get_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class ServiceSerializer(serializers.ModelSerializer):
    gallery = ServiceImageSerializer(source="images", many=True, read_only=True)

    class Meta:
        model = ServiceOffer
        fields = (
            "id", "slug", "title", "category", "short_description", "description", "price_note", "base_price", "cover_image", "features",
            "inclusions", "exclusions", "preparation_notes", "cancellation_text", "fulfillment_mode", "pricing_model", "unit_label",
            "minimum_quantity", "maximum_quantity", "minimum_lead_hours", "default_daily_capacity", "schedule_type", "featured", "gallery",
        )

    def to_representation(self, instance):
        return with_uploaded_cover(instance, super().to_representation(instance), self.context.get("request"))


class ServiceAdminSerializer(ServiceSerializer):
    eligible_villa_slugs = serializers.SlugRelatedField(source="eligible_villas", slug_field="slug", many=True, required=False, queryset=Villa.objects.all())
    reservation_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(ServiceSerializer.Meta):
        fields = ServiceSerializer.Meta.fields + ("status", "sort_order", "eligible_villa_slugs", "reservation_count")
        read_only_fields = ("id", "gallery", "reservation_count")

    def validate(self, attrs):
        instance = self.instance
        pricing_model = attrs.get("pricing_model", getattr(instance, "pricing_model", ServiceOffer.PricingModel.FIXED))
        minimum = attrs.get("minimum_quantity", getattr(instance, "minimum_quantity", 1))
        maximum = attrs.get("maximum_quantity", getattr(instance, "maximum_quantity", 1))
        if maximum < minimum:
            raise serializers.ValidationError({"maximum_quantity": "حداکثر تعداد نمی‌تواند کمتر از حداقل باشد."})
        if pricing_model != ServiceOffer.PricingModel.PER_UNIT and (minimum != 1 or maximum != 1):
            raise serializers.ValidationError({"maximum_quantity": "بازه تعداد فقط برای قیمت‌گذاری واحدی قابل تنظیم است."})
        return attrs


class InquirySerializer(serializers.ModelSerializer):
    listing_slug = serializers.SlugField(required=False, write_only=True)
    contractor_slug = serializers.SlugField(required=False, write_only=True)
    service_slug = serializers.SlugField(required=False, write_only=True)
    phone = serializers.CharField(max_length=30)

    class Meta:
        model = Inquiry
        fields = ("id", "kind", "listing_slug", "contractor_slug", "service_slug", "name", "phone", "message", "status", "created_at")
        read_only_fields = ("status", "created_at")

    def validate_phone(self, value):
        digits = re.sub(r"\D", "", value)
        if digits.startswith("98") and len(digits) == 12:
            digits = "0" + digits[2:]
        if not re.fullmatch(r"09\d{9}", digits):
            raise serializers.ValidationError("شماره موبایل معتبر وارد کنید.")
        return digits

    def validate(self, attrs):
        kind = attrs["kind"]
        listing_slug = attrs.pop("listing_slug", None)
        contractor_slug = attrs.pop("contractor_slug", None)
        service_slug = attrs.pop("service_slug", None)
        if kind == Inquiry.Kind.REAL_ESTATE:
            try:
                attrs["real_estate"] = RealEstateListing.objects.get(slug=listing_slug, status=RealEstateListing.Status.PUBLISHED)
            except RealEstateListing.DoesNotExist as exc:
                raise serializers.ValidationError({"listing_slug": "ملک انتخاب‌شده پیدا نشد."}) from exc
        elif kind == Inquiry.Kind.CONTRACTOR:
            try:
                attrs["contractor"] = Contractor.objects.get(slug=contractor_slug, status=Contractor.Status.PUBLISHED)
            except Contractor.DoesNotExist as exc:
                raise serializers.ValidationError({"contractor_slug": "پیمانکار انتخاب‌شده پیدا نشد."}) from exc
        elif kind == Inquiry.Kind.SERVICE:
            try:
                attrs["service"] = ServiceOffer.objects.get(slug=service_slug, status=ServiceOffer.Status.PUBLISHED)
            except ServiceOffer.DoesNotExist as exc:
                raise serializers.ValidationError({"service_slug": "خدمت انتخاب‌شده پیدا نشد."}) from exc
        return attrs


class InquiryAdminSerializer(serializers.ModelSerializer):
    target = serializers.SerializerMethodField()
    assigned_contractor = serializers.SerializerMethodField()
    assigned_contractor_slug = serializers.SlugField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Inquiry
        fields = ("id", "kind", "name", "phone", "message", "status", "admin_note", "follow_up_at", "target", "assigned_contractor", "assigned_contractor_slug", "created_at")
        read_only_fields = ("id", "kind", "name", "phone", "message", "target", "created_at")

    def get_target(self, obj):
        return obj.real_estate.title if obj.real_estate else obj.contractor.name if obj.contractor else obj.service.title if obj.service else "—"

    def get_assigned_contractor(self, obj):
        if not obj.assigned_contractor:
            return None
        return {"slug": obj.assigned_contractor.slug, "name": obj.assigned_contractor.name}

    def validate(self, attrs):
        instance = self.instance
        status_value = attrs.get("status", instance.status if instance else Inquiry.Status.NEW)
        if instance and instance.kind == Inquiry.Kind.CONTRACTOR:
            transitions = {
                Inquiry.Status.NEW: {Inquiry.Status.NEW, Inquiry.Status.CONTACTED},
                Inquiry.Status.CONTACTED: {Inquiry.Status.CONTACTED, Inquiry.Status.INTRODUCED},
                Inquiry.Status.INTRODUCED: {Inquiry.Status.INTRODUCED, Inquiry.Status.CLOSED},
                Inquiry.Status.CLOSED: {Inquiry.Status.CLOSED},
            }
            if status_value not in transitions.get(instance.status, {instance.status}):
                raise serializers.ValidationError({"status": "وضعیت درخواست باید به ترتیب پیگیری شود."})
        assigned = attrs.get("assigned_contractor", instance.assigned_contractor if instance else None)
        assigned_slug = attrs.pop("assigned_contractor_slug", serializers.empty)
        if assigned_slug is not serializers.empty:
            if assigned_slug in (None, ""):
                assigned = None
            else:
                try:
                    assigned = Contractor.objects.get(slug=assigned_slug, status=Contractor.Status.PUBLISHED)
                except Contractor.DoesNotExist as exc:
                    raise serializers.ValidationError({"assigned_contractor_slug": "پیمانکار انتخاب‌شده پیدا نشد."}) from exc
            attrs["assigned_contractor"] = assigned
        if instance and instance.kind == Inquiry.Kind.CONTRACTOR and status_value == Inquiry.Status.INTRODUCED and not assigned:
            raise serializers.ValidationError({"assigned_contractor_slug": "برای معرفی، یک پیمانکار اصلی انتخاب کنید."})
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        return Inquiry.objects.create(user=request.user if request.user.is_authenticated else None, **validated_data)
