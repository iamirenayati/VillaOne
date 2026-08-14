from django.contrib import admin
from .models import Amenity, Availability, City, Favorite, PriceOverride, Villa, VillaImage


class VillaImageInline(admin.TabularInline):
    model = VillaImage
    extra = 1
    fields = ("uploaded_image", "url", "alt_text", "order")


class AvailabilityInline(admin.TabularInline):
    model = Availability
    extra = 0
    fields = ("date", "status", "note")


@admin.register(Villa)
class VillaAdmin(admin.ModelAdmin):
    list_display = ("title", "city", "owner", "price_weekday", "is_instant_bookable", "status", "featured", "updated_at")
    list_filter = ("status", "featured", "is_instant_bookable", "city")
    search_fields = ("title", "owner__phone", "city__name")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("amenities",)
    inlines = (VillaImageInline, AvailabilityInline)


admin.site.register(City)
admin.site.register(Amenity)
admin.site.register(Availability)
admin.site.register(PriceOverride)
admin.site.register(Favorite)
admin.site.site_header = "مدیریت ویلاوان"
admin.site.site_title = "VillaOne Admin"
admin.site.index_title = "مرکز عملیات"
