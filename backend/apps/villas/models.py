from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class City(models.Model):
    name = models.CharField(max_length=80, unique=True)
    region = models.CharField(max_length=80, default="مازندران")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "شهرها"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Amenity(models.Model):
    name = models.CharField(max_length=80, unique=True)
    icon = models.CharField(max_length=40, blank=True)

    class Meta:
        verbose_name_plural = "امکانات"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Villa(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PENDING_REVIEW = "pending_review", "در انتظار بررسی"
        PUBLISHED = "published", "منتشرشده"
        SUSPENDED = "suspended", "تعلیق‌شده"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_villas")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="villas")
    slug = models.SlugField(max_length=140, unique=True)
    title = models.CharField(max_length=140)
    description = models.TextField()
    address = models.TextField(blank=True, help_text="فقط پس از رزرو تأییدشده نمایش داده می‌شود.")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    map_radius_meters = models.PositiveIntegerField(default=500)
    setting_tags = models.JSONField(default=list, blank=True)
    bedrooms = models.PositiveSmallIntegerField(default=1)
    beds = models.PositiveSmallIntegerField(default=1)
    bathrooms = models.PositiveSmallIntegerField(default=1)
    capacity = models.PositiveSmallIntegerField(default=2)
    price_weekday = models.DecimalField(max_digits=14, decimal_places=0, validators=[MinValueValidator(0)])
    price_weekend = models.DecimalField(max_digits=14, decimal_places=0, validators=[MinValueValidator(0)])
    price_holiday = models.DecimalField(max_digits=14, decimal_places=0, validators=[MinValueValidator(0)])
    deposit_percentage = models.PositiveSmallIntegerField(default=30)
    cancellation_policy = models.JSONField(default=dict, blank=True)
    is_instant_bookable = models.BooleanField(default=False)
    requires_id_verification = models.BooleanField(default=True)
    amenities = models.ManyToManyField(Amenity, related_name="villas", blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT, db_index=True)
    featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-featured", "-created_at"]
        indexes = [models.Index(fields=["city", "status"]), models.Index(fields=["status", "featured"])]

    def __str__(self):
        return self.title


class VillaImage(models.Model):
    villa = models.ForeignKey(Villa, on_delete=models.CASCADE, related_name="images")
    url = models.URLField(max_length=700, blank=True, default="")
    uploaded_image = models.ImageField(upload_to="villas/%Y/%m/", blank=True)
    alt_text = models.CharField(max_length=180, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_villas")
    villa = models.ForeignKey(Villa, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "villa"], name="unique_user_favorite_villa")]
        ordering = ["-created_at"]


class Availability(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "آزاد"
        BLOCKED = "blocked", "مسدود"
        BOOKED = "booked", "رزروشده"

    villa = models.ForeignKey(Villa, on_delete=models.CASCADE, related_name="availability")
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    note = models.CharField(max_length=180, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["villa", "date"], name="unique_villa_availability_date")]
        ordering = ["date"]


class PriceOverride(models.Model):
    villa = models.ForeignKey(Villa, on_delete=models.CASCADE, related_name="price_overrides")
    date = models.DateField(db_index=True)
    price = models.DecimalField(max_digits=14, decimal_places=0, validators=[MinValueValidator(0)])

    class Meta:
        constraints = [models.UniqueConstraint(fields=["villa", "date"], name="unique_villa_price_date")]
        ordering = ["date"]
