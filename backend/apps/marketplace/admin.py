from django.contrib import admin
from django.http import HttpResponseForbidden, JsonResponse
from django.urls import path

from .article_rendering import render_article_body
from .forms import ArticleAdminForm
from .models import Article, ArticleImage, BusinessSettings, Contractor, Inquiry, RealEstateListing, ServiceAvailability, ServiceImage, ServiceOffer


@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ("هویت و ارتباط", {"fields": ("brand_name", "support_phone", "support_whatsapp", "operating_hours", "footer_description")} ),
        ("پرداخت کارت به کارت", {"fields": ("card_transfer_enabled", "card_transfer_bank_name", "card_transfer_cardholder_name", "card_transfer_card_number")} ),
        ("متن‌های قانونی", {"fields": ("terms_text", "privacy_text", "cancellation_text")} ),
    )

    def has_add_permission(self, request):
        return not BusinessSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RealEstateListing)
class RealEstateAdmin(admin.ModelAdmin):
    list_display = ("title", "city", "property_type", "price", "status", "is_featured")
    list_filter = ("status", "property_type", "city", "is_featured")
    search_fields = ("title", "city", "neighborhood", "description")
    prepopulated_fields = {"slug": ("title",)}
    fieldsets = (("اطلاعات", {"fields": ("title", "slug", "city", "neighborhood", "property_type", "price", "area_m2", "bedrooms", "description", "features")}), ("تصویر", {"fields": ("uploaded_cover_image", "cover_image")}), ("انتشار", {"fields": ("status", "is_featured")}))


@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display = ("name", "specialty", "city", "verified", "featured", "status")
    list_filter = ("status", "verified", "featured", "city")
    search_fields = ("name", "specialty", "description")
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (("پروفایل", {"fields": ("name", "slug", "specialty", "city", "years_experience", "description", "services", "catalog")}), ("تصویر", {"fields": ("uploaded_cover_image", "cover_image")}), ("اعتماد و انتشار", {"fields": ("verified", "featured", "status")}))


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    form = ArticleAdminForm
    inlines = ()
    list_display = ("title", "category", "author_name", "status", "published_at")
    list_filter = ("status", "category", "published_at")
    search_fields = ("title", "excerpt", "body")
    prepopulated_fields = {"slug": ("title",)}
    fieldsets = (
        ("مقاله", {"fields": ("title", "slug", "excerpt", "body", "category", "author_name")} ),
        ("تصویر جلد", {"fields": ("uploaded_cover_image", "cover_image", "cover_alt")} ),
        ("دعوت به اقدام اختیاری", {"fields": ("cta_label", "cta_url")} ),
        ("انتشار", {"fields": ("status", "published_at")} ),
    )
    readonly_fields = ("published_at",)

    class Media:
        js = ("marketplace/article_admin.js",)
        css = {"all": ("marketplace/article_admin.css",)}

    def get_inline_instances(self, request, obj=None):
        if obj is None:
            return []
        return [ArticleImageInline(self.model, self.admin_site)]

    def _is_main_admin(self, request):
        return bool(request.user and request.user.is_superuser)

    def has_module_permission(self, request):
        return self._is_main_admin(request)

    def has_view_permission(self, request, obj=None):
        return self._is_main_admin(request)

    def has_add_permission(self, request):
        return self._is_main_admin(request)

    def has_change_permission(self, request, obj=None):
        return self._is_main_admin(request)

    def has_delete_permission(self, request, obj=None):
        return False

    def get_urls(self):
        urls = [path("preview/", self.admin_site.admin_view(self.preview_view), name="marketplace_article_preview")]
        return urls + super().get_urls()

    def preview_view(self, request):
        if not request.user.is_superuser:
            return HttpResponseForbidden("مجاز نیست.")
        if request.method != "POST":
            return JsonResponse({"detail": "فقط POST مجاز است."}, status=405)
        article_id = request.POST.get("article_id")
        article = Article.objects.filter(pk=article_id).prefetch_related("inline_images").first() if article_id else Article()
        article.body = request.POST.get("body", "")
        return JsonResponse({"body_html": render_article_body(article, request)})


class ArticleImageInline(admin.TabularInline):
    model = ArticleImage
    extra = 0
    fields = ("key", "image", "alt_text", "caption", "sort_order", "width", "height")
    readonly_fields = ("width", "height")


@admin.register(ArticleImage)
class ArticleImageAdmin(admin.ModelAdmin):
    list_display = ("article", "key", "alt_text", "sort_order", "width", "height")
    list_filter = ("article",)
    search_fields = ("article__title", "key", "alt_text", "caption")
    readonly_fields = ("width", "height")

    def _is_main_admin(self, request):
        return bool(request.user and request.user.is_superuser)

    def has_module_permission(self, request):
        return self._is_main_admin(request)

    def has_view_permission(self, request, obj=None):
        return self._is_main_admin(request)

    def has_add_permission(self, request):
        return self._is_main_admin(request)

    def has_change_permission(self, request, obj=None):
        return self._is_main_admin(request)

    def has_delete_permission(self, request, obj=None):
        return self._is_main_admin(request)


@admin.register(Inquiry)
class InquiryAdmin(admin.ModelAdmin):
    list_display = ("created_at", "kind", "name", "phone", "real_estate", "contractor", "service", "status")
    list_filter = ("kind", "status", "created_at")
    search_fields = ("name", "phone", "message", "real_estate__title", "contractor__name")
    readonly_fields = ("user", "kind", "real_estate", "contractor", "service", "name", "phone", "message", "created_at")


@admin.register(ServiceOffer)
class ServiceOfferAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "fulfillment_mode", "pricing_model", "base_price", "featured", "status")
    list_filter = ("status", "category", "fulfillment_mode", "pricing_model", "featured")
    search_fields = ("title", "description", "category")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("eligible_villas",)
    fieldsets = (
        ("معرفی", {"fields": ("title", "slug", "category", "short_description", "description", "features", "inclusions", "exclusions")}),
        ("قیمت و رزرو", {"fields": ("fulfillment_mode", "pricing_model", "base_price", "price_note", "unit_label", "minimum_quantity", "maximum_quantity", "schedule_type", "minimum_lead_hours", "default_daily_capacity", "eligible_villas")}),
        ("انتظارات مشتری", {"fields": ("preparation_notes", "cancellation_text")}),
        ("تصویر", {"fields": ("uploaded_cover_image", "cover_image")}),
        ("انتشار", {"fields": ("featured", "sort_order", "status")}),
    )


@admin.register(ServiceImage)
class ServiceImageAdmin(admin.ModelAdmin):
    list_display = ("service", "alt_text", "sort_order")
    list_filter = ("service",)
    ordering = ("service", "sort_order")


@admin.register(ServiceAvailability)
class ServiceAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("service", "date", "status", "capacity_override", "price_override")
    list_filter = ("service", "status", "date")
    search_fields = ("service__title", "admin_note")
