from django.conf import settings
import io
import re

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.core.files.base import ContentFile


ARTICLE_IMAGE_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,48}$")
ARTICLE_IMAGE_EXTENSIONS = ("jpg", "jpeg", "png", "webp")


def validate_article_upload(upload):
    """Validate content images at the Django form/model boundary."""
    if not upload:
        return
    if getattr(upload, "size", 0) > 5 * 1024 * 1024:
        raise ValidationError("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.")
    try:
        from PIL import Image

        upload.seek(0)
        with Image.open(upload) as image:
            image.verify()
        upload.seek(0)
        with Image.open(upload) as image:
            if image.format.lower() not in ARTICLE_IMAGE_EXTENSIONS:
                raise ValidationError("فرمت تصویر باید JPEG، PNG یا WebP باشد.")
            if image.width < 640 or image.height < 360:
                raise ValidationError("ابعاد تصویر برای انتشار کافی نیست (حداقل ۶۴۰×۳۶۰ پیکسل).")
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError("فایل تصویر معتبر نیست.") from exc
    finally:
        try:
            upload.seek(0)
        except (AttributeError, ValueError):
            pass


def validate_article_image_key(value):
    if not ARTICLE_IMAGE_KEY_RE.fullmatch(value or ""):
        raise ValidationError("کلید تصویر معتبر نیست.")


def normalize_article_upload(field):
    """Strip EXIF metadata and apply the camera's orientation on first save."""
    if not field or getattr(field, "_committed", True) or not getattr(field, "name", ""):
        return
    try:
        from PIL import Image, ImageOps

        with Image.open(field.file) as source:
            image = ImageOps.exif_transpose(source)
            output = io.BytesIO()
            image.save(output, format=source.format, optimize=True)
        field.save(field.name, ContentFile(output.getvalue()), save=False)
    except (AttributeError, FileNotFoundError, OSError):
        # String-backed legacy URLs and already-remote files are left untouched.
        return


class BusinessSettings(models.Model):
    """Single editable source for public VillaOne business and trust content."""

    brand_name = models.CharField(max_length=100, default="ویلاوان")
    support_phone = models.CharField(max_length=30, blank=True)
    support_whatsapp = models.CharField(max_length=30, blank=True)
    operating_hours = models.CharField(max_length=180, blank=True)
    footer_description = models.TextField(blank=True)
    terms_text = models.TextField(blank=True)
    privacy_text = models.TextField(blank=True)
    cancellation_text = models.TextField(blank=True)
    card_transfer_enabled = models.BooleanField(default=False)
    card_transfer_bank_name = models.CharField(max_length=100, blank=True)
    card_transfer_cardholder_name = models.CharField(max_length=120, blank=True)
    card_transfer_card_number = models.CharField(max_length=32, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات کسب‌وکار"
        verbose_name_plural = "تنظیمات کسب‌وکار"

    def save(self, *args, **kwargs):
        self.pk = 1
        return super().save(*args, **kwargs)

    @classmethod
    def current(cls):
        return cls.objects.get(pk=1)

    @property
    def is_launch_ready(self):
        return bool(self.support_phone and self.operating_hours and self.footer_description and self.terms_text and self.privacy_text and self.cancellation_text)


class PublishableModel(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PUBLISHED = "published", "منتشرشده"
        ARCHIVED = "archived", "بایگانی"

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class RealEstateListing(PublishableModel):
    class PropertyType(models.TextChoices):
        VILLA = "villa", "ویلا"
        LAND = "land", "زمین"
        APARTMENT = "apartment", "آپارتمان"

    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=180)
    city = models.CharField(max_length=100, db_index=True)
    neighborhood = models.CharField(max_length=120, blank=True)
    property_type = models.CharField(max_length=16, choices=PropertyType.choices, default=PropertyType.VILLA)
    price = models.DecimalField(max_digits=16, decimal_places=0)
    area_m2 = models.PositiveIntegerField()
    bedrooms = models.PositiveSmallIntegerField(default=0)
    description = models.TextField()
    features = models.JSONField(default=list, blank=True)
    cover_image = models.CharField(max_length=500, blank=True, default="")
    uploaded_cover_image = models.ImageField(upload_to="real-estate/%Y/%m/", blank=True)
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_featured", "-created_at"]

    def __str__(self):
        return self.title


class Contractor(PublishableModel):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=160)
    specialty = models.CharField(max_length=140)
    city = models.CharField(max_length=100, db_index=True)
    years_experience = models.PositiveSmallIntegerField(default=0)
    description = models.TextField()
    services = models.JSONField(default=list, blank=True)
    catalog = models.JSONField(default=list, blank=True)
    cover_image = models.CharField(max_length=500, blank=True, default="")
    uploaded_cover_image = models.ImageField(upload_to="contractors/%Y/%m/", blank=True)
    verified = models.BooleanField(default=False)
    featured = models.BooleanField(default=False)

    class Meta:
        ordering = ["-featured", "-verified", "name"]

    def __str__(self):
        return self.name


class Article(PublishableModel):
    class Category(models.TextChoices):
        GUIDE = "guide", "راهنمای سفر"
        STAY = "stay", "اقامت و ویلا"
        DESIGN = "design", "معماری و بازسازی"
        PROPERTY = "property", "ملک و سرمایه‌گذاری"
        LOCAL = "local", "تجربه و خدمات محلی"

    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=200)
    excerpt = models.TextField()
    body = models.TextField()
    category = models.CharField(max_length=24, choices=Category.choices, default=Category.GUIDE, db_index=True)
    author_name = models.CharField(max_length=100, default="تحریریه ویلاوان")
    cover_image = models.CharField(max_length=500, blank=True, default="")
    uploaded_cover_image = models.ImageField(
        upload_to="articles/%Y/%m/",
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=ARTICLE_IMAGE_EXTENSIONS), validate_article_upload],
    )
    cover_alt = models.CharField(max_length=180, blank=True, default="")
    cta_label = models.CharField(max_length=80, blank=True, default="")
    cta_url = models.CharField(max_length=220, blank=True, default="")
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        errors = {}
        if self.cta_label and not self.cta_url:
            errors["cta_url"] = "برای دکمه، مسیر داخلی را وارد کنید."
        if self.cta_url and (not self.cta_url.startswith("/") or self.cta_url.startswith("//") or "\\" in self.cta_url or any(ord(char) < 32 for char in self.cta_url)):
            errors["cta_url"] = "لینک مقاله باید یک مسیر داخلی ویلاوان باشد."
        if self.status == self.Status.PUBLISHED:
            if not self.title.strip():
                errors["title"] = "عنوان برای انتشار الزامی است."
            if not self.excerpt.strip():
                errors["excerpt"] = "خلاصه برای انتشار الزامی است."
            if not self.body.strip():
                errors["body"] = "متن مقاله برای انتشار الزامی است."
            if not ((self.cover_image or "").strip() or self.uploaded_cover_image):
                errors["cover_image"] = "تصویر جلد برای انتشار الزامی است."
            if not self.cover_alt.strip():
                errors["cover_alt"] = "متن جایگزین تصویر جلد برای انتشار الزامی است."

            from .article_rendering import referenced_image_keys

            image_keys = set(self.inline_images.values_list("key", flat=True)) if self.pk else set()
            missing = sorted(referenced_image_keys(self.body) - image_keys)
            if missing:
                errors["body"] = f"تصویرهای ناموجود: {', '.join(missing)}"
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).only("status", "slug", "published_at").first()
            if previous and previous.status in {self.Status.PUBLISHED, self.Status.ARCHIVED} and previous.slug != self.slug:
                raise ValidationError("نشانی مقاله منتشرشده قابل تغییر نیست.")
        if self.status == self.Status.PUBLISHED and not self.published_at:
            from django.utils import timezone

            self.published_at = timezone.now()
        normalize_article_upload(self.uploaded_cover_image)
        return super().save(*args, **kwargs)


class ArticleImage(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="inline_images")
    key = models.SlugField(max_length=50, validators=[validate_article_image_key])
    image = models.ImageField(
        upload_to="articles/inline/%Y/%m/",
        validators=[FileExtensionValidator(allowed_extensions=ARTICLE_IMAGE_EXTENSIONS), validate_article_upload],
    )
    alt_text = models.CharField(max_length=180)
    caption = models.CharField(max_length=240, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    width = models.PositiveIntegerField(default=0, editable=False)
    height = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [models.UniqueConstraint(fields=["article", "key"], name="unique_article_image_key")]

    def clean(self):
        super().clean()
        if not ARTICLE_IMAGE_KEY_RE.fullmatch(self.key or ""):
            raise ValidationError({"key": "کلید تصویر باید با حروف کوچک انگلیسی، عدد، خط تیره یا زیرخط باشد."})
        if not (self.alt_text or "").strip():
            raise ValidationError({"alt_text": "متن جایگزین تصویر الزامی است."})

    def __str__(self):
        return f"{self.article.title} — {self.key}"

    def save(self, *args, **kwargs):
        normalize_article_upload(self.image)
        try:
            self.width = self.image.width
            self.height = self.image.height
        except (AttributeError, FileNotFoundError, OSError):
            pass
        return super().save(*args, **kwargs)


class ServiceOffer(PublishableModel):
    class FulfillmentMode(models.TextChoices):
        BOOKABLE = "bookable", "قابل رزرو"
        INQUIRY_ONLY = "inquiry_only", "فقط درخواست هماهنگی"
        BOTH = "both", "رزرو یا هماهنگی"

    class PricingModel(models.TextChoices):
        FIXED = "fixed", "مبلغ ثابت"
        PER_GUEST = "per_guest", "برای هر مهمان"
        PER_NIGHT = "per_night", "برای هر شب"
        PER_UNIT = "per_unit", "برای هر واحد"

    class ScheduleType(models.TextChoices):
        NONE = "none", "بدون انتخاب تاریخ"
        STAY_DATE = "stay_date", "یک روز از اقامت"
        CHECKIN = "checkin", "روز ورود"
        CHECKOUT = "checkout", "روز خروج"

    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=80)
    short_description = models.CharField(max_length=220, blank=True)
    description = models.TextField()
    price_note = models.CharField(max_length=160)
    base_price = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    cover_image = models.CharField(max_length=500, blank=True, default="")
    uploaded_cover_image = models.ImageField(upload_to="services/%Y/%m/", blank=True)
    features = models.JSONField(default=list, blank=True)
    inclusions = models.JSONField(default=list, blank=True)
    exclusions = models.JSONField(default=list, blank=True)
    preparation_notes = models.TextField(blank=True)
    cancellation_text = models.TextField(blank=True)
    fulfillment_mode = models.CharField(max_length=16, choices=FulfillmentMode.choices, default=FulfillmentMode.BOOKABLE, db_index=True)
    pricing_model = models.CharField(max_length=16, choices=PricingModel.choices, default=PricingModel.FIXED)
    unit_label = models.CharField(max_length=40, default="خدمت")
    minimum_quantity = models.PositiveSmallIntegerField(default=1)
    maximum_quantity = models.PositiveSmallIntegerField(default=1)
    minimum_lead_hours = models.PositiveSmallIntegerField(default=0)
    default_daily_capacity = models.PositiveSmallIntegerField(default=1)
    schedule_type = models.CharField(max_length=16, choices=ScheduleType.choices, default=ScheduleType.NONE)
    featured = models.BooleanField(default=False, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    eligible_villas = models.ManyToManyField("villas.Villa", blank=True, related_name="eligible_services")

    class Meta:
        ordering = ["sort_order", "-featured", "category", "title"]

    def clean(self):
        if self.maximum_quantity < self.minimum_quantity:
            from django.core.exceptions import ValidationError
            raise ValidationError({"maximum_quantity": "حداکثر تعداد نمی‌تواند کمتر از حداقل باشد."})
        if self.pricing_model != self.PricingModel.PER_UNIT and (self.minimum_quantity != 1 or self.maximum_quantity != 1):
            from django.core.exceptions import ValidationError
            raise ValidationError("حداقل و حداکثر تعداد فقط برای قیمت‌گذاری واحدی قابل تغییر است.")

    def __str__(self):
        return self.title


class ServiceImage(models.Model):
    service = models.ForeignKey(ServiceOffer, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="services/gallery/%Y/%m/")
    alt_text = models.CharField(max_length=180, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class ServiceAvailability(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "قابل رزرو"
        BLOCKED = "blocked", "مسدود"
        CLOSED = "closed", "تعطیل"

    service = models.ForeignKey(ServiceOffer, on_delete=models.CASCADE, related_name="availability")
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.AVAILABLE)
    capacity_override = models.PositiveSmallIntegerField(null=True, blank=True)
    price_override = models.DecimalField(max_digits=14, decimal_places=0, null=True, blank=True)
    admin_note = models.CharField(max_length=300, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]
        constraints = [models.UniqueConstraint(fields=["service", "date"], name="unique_service_availability_date")]


class Inquiry(models.Model):
    class Kind(models.TextChoices):
        REAL_ESTATE = "real_estate", "مشاوره ملک"
        CONTRACTOR = "contractor", "درخواست پیمانکار"
        SERVICE = "service", "خدمات سفر"

    class Status(models.TextChoices):
        NEW = "new", "جدید"
        CONTACTED = "contacted", "تماس گرفته شد"
        INTRODUCED = "introduced", "معرفی شده"
        CLOSED = "closed", "بسته"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="marketplace_inquiries")
    kind = models.CharField(max_length=20, choices=Kind.choices, db_index=True)
    real_estate = models.ForeignKey(RealEstateListing, on_delete=models.PROTECT, null=True, blank=True, related_name="inquiries")
    contractor = models.ForeignKey(Contractor, on_delete=models.PROTECT, null=True, blank=True, related_name="inquiries")
    service = models.ForeignKey(ServiceOffer, on_delete=models.PROTECT, null=True, blank=True, related_name="inquiries")
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15, db_index=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    admin_note = models.TextField(blank=True)
    follow_up_at = models.DateTimeField(null=True, blank=True, db_index=True)
    assigned_contractor = models.ForeignKey(Contractor, on_delete=models.PROTECT, null=True, blank=True, related_name="assigned_inquiries")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} — {self.phone}"
