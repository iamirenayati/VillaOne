from datetime import timedelta
from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.villas.models import City, Villa
from PIL import Image

from .models import Article, ArticleImage, BusinessSettings, Contractor, Inquiry, RealEstateListing, ServiceAvailability, ServiceOffer


class MarketplaceApiTests(APITestCase):
    def setUp(self):
        self.listing = RealEstateListing.objects.create(slug="forest-villa", title="ویلای جنگلی", city="سوادکوه", price=10_000_000_000, area_m2=500, bedrooms=3, description="ویلای تست", cover_image="/image.jpg", status="published")
        self.contractor = Contractor.objects.create(slug="test-studio", name="استودیو تست", specialty="معماری", city="ساری", description="پیمانکار تست", cover_image="/image.jpg", status="published", verified=True, featured=True)
        self.article = Article.objects.create(slug="test-guide", title="راهنمای تست", excerpt="خلاصه", body="متن مقاله", cover_image="/image.jpg", status="published")
        self.service = ServiceOffer.objects.create(slug="test-breakfast", title="صبحانه تست", category="پذیرایی", description="خدمت تست", price_note="با هماهنگی", cover_image="/image.jpg", status="published")

    def test_public_catalogs_and_details(self):
        Contractor.objects.create(slug="plain-studio", name="استودیو عادی", specialty="بازسازی", city="ساری", description="تست", cover_image="/image.jpg", status="published", verified=True, featured=False)
        self.assertEqual(self.client.get(reverse("real-estate-list")).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse("real-estate-detail", kwargs={"slug": self.listing.slug})).data["title"], self.listing.title)
        self.assertEqual(self.client.get(reverse("contractor-list")).data[0]["name"], self.contractor.name)
        self.assertIn("catalog", self.client.get(reverse("contractor-detail", kwargs={"slug": self.contractor.slug})).data)
        self.assertEqual(self.client.get(reverse("article-detail", kwargs={"slug": self.article.slug})).data["body"], self.article.body)

    def test_anonymous_real_estate_inquiry_reaches_admin_queue(self):
        response = self.client.post(reverse("inquiry-create"), {"kind": "real_estate", "listing_slug": self.listing.slug, "name": "علی رضایی", "phone": "09121234567", "message": "برای بازدید تماس بگیرید."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(Inquiry.objects.filter(real_estate=self.listing, phone="09121234567").exists())

    def test_contractor_inquiry_validates_target_and_phone(self):
        response = self.client.post(reverse("inquiry-create"), {"kind": "contractor", "contractor_slug": self.contractor.slug, "name": "مینا", "phone": "+98 912 123 4567", "message": "برآورد بازسازی می‌خواهم."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["phone"], "09121234567")

        invalid = self.client.post(reverse("inquiry-create"), {"kind": "contractor", "contractor_slug": "missing", "name": "مینا", "phone": "123"}, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_service_catalog_and_inquiry(self):
        services = self.client.get(reverse("service-list"))
        inquiry = self.client.post(reverse("inquiry-create"), {"kind": "service", "service_slug": self.service.slug, "name": "رضا", "phone": "09121234567", "message": "برای آخر هفته هماهنگ شود."}, format="json")
        self.assertEqual(services.status_code, status.HTTP_200_OK)
        self.assertEqual(inquiry.status_code, status.HTTP_201_CREATED, inquiry.data)
        self.assertTrue(Inquiry.objects.filter(service=self.service).exists())

    def test_service_detail_and_admin_catalog_are_backend_driven(self):
        self.service.fulfillment_mode = ServiceOffer.FulfillmentMode.BOOKABLE
        self.service.pricing_model = ServiceOffer.PricingModel.PER_GUEST
        self.service.featured = True
        self.service.short_description = "صبحانه تازه در ویلا"
        self.service.save()
        detail = self.client.get(reverse("service-detail", kwargs={"slug": self.service.slug}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["pricing_model"], "per_guest")
        self.assertTrue(detail.data["featured"])
        self.assertIn("gallery", detail.data)

        admin = User.objects.create_user(username="service-admin", phone="09120000031", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(admin)
        catalog = self.client.get(reverse("admin-service-list"))
        self.assertEqual(catalog.status_code, status.HTTP_200_OK)
        self.assertEqual(catalog.data[0]["slug"], self.service.slug)
        updated = self.client.patch(reverse("admin-service-detail", kwargs={"slug": self.service.slug}), {"minimum_lead_hours": 36, "featured": False}, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
        self.assertEqual(updated.data["minimum_lead_hours"], 36)

    def test_eligible_services_respect_villa_assignment(self):
        owner = User.objects.create_user(username="service-owner", phone="09120000032")
        city = City.objects.create(name="ساری")
        allowed = Villa.objects.create(owner=owner, city=city, slug="service-villa", title="ویلای خدمات", description="تست", capacity=4, price_weekday=1_000_000, price_weekend=1_000_000, price_holiday=1_000_000, status=Villa.Status.PUBLISHED)
        other = Villa.objects.create(owner=owner, city=city, slug="other-villa", title="ویلای دیگر", description="تست", capacity=4, price_weekday=1_000_000, price_weekend=1_000_000, price_holiday=1_000_000, status=Villa.Status.PUBLISHED)
        self.service.fulfillment_mode = ServiceOffer.FulfillmentMode.BOOKABLE
        self.service.save()
        self.service.eligible_villas.add(allowed)

        visible = self.client.get(reverse("service-eligible"), {"villa": allowed.slug, "checkin": "2026-08-20", "checkout": "2026-08-23", "guests": 2})
        hidden = self.client.get(reverse("service-eligible"), {"villa": other.slug, "checkin": "2026-08-20", "checkout": "2026-08-23", "guests": 2})

        self.assertEqual(visible.status_code, status.HTTP_200_OK)
        self.assertEqual([item["slug"] for item in visible.data], [self.service.slug])
        self.assertEqual(hidden.status_code, status.HTTP_200_OK)
        self.assertEqual(hidden.data, [])

    def test_content_admin_can_bulk_manage_service_availability(self):
        admin = User.objects.create_user(username="calendar-admin", phone="09120000033", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(admin)
        response = self.client.patch(reverse("admin-service-availability", kwargs={"slug": self.service.slug}), {
            "dates": ["2026-08-21", "2026-08-22"],
            "status": "blocked",
            "capacity_override": 2,
            "admin_note": "تیم در دسترس نیست",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(ServiceAvailability.objects.filter(service=self.service, status="blocked").count(), 2)
        calendar = self.client.get(reverse("admin-service-availability", kwargs={"slug": self.service.slug}), {"start": "2026-08-20", "days": 5})
        self.assertEqual(calendar.status_code, status.HTTP_200_OK)
        self.assertEqual(len(calendar.data["days"]), 5)
        self.assertTrue(any(day["status"] == "blocked" for day in calendar.data["days"]))

    def test_unpublished_contractors_are_hidden_from_public_catalog(self):
        Contractor.objects.create(slug="draft-studio", name="استودیو پیش‌نویس", specialty="بازسازی", city="ساری", description="تست", cover_image="/image.jpg", status="draft")
        Contractor.objects.create(slug="archived-studio", name="استودیو بایگانی", specialty="بازسازی", city="ساری", description="تست", cover_image="/image.jpg", status="archived")
        response = self.client.get(reverse("contractor-list"))
        self.assertEqual([item["slug"] for item in response.data], [self.contractor.slug])
        self.assertEqual(self.client.get(reverse("contractor-detail", kwargs={"slug": "draft-studio"})).status_code, status.HTTP_404_NOT_FOUND)

    def test_content_admin_can_manage_contractors_and_filter_inquiries(self):
        admin = User.objects.create_user(username="market-admin", phone="09120000011", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(admin)
        contractor_response = self.client.get(reverse("admin-contractor-list"), {"q": "استودیو"})
        self.assertEqual(contractor_response.status_code, status.HTTP_200_OK)
        self.assertEqual(contractor_response.data[0]["inquiry_count"], 0)
        update = self.client.patch(reverse("admin-contractor-update", kwargs={"slug": self.contractor.slug}), {"featured": False, "verified": True}, format="json")
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertFalse(update.data["featured"])

    def test_contractor_lead_workflow_requires_assignment_before_introduction(self):
        admin = User.objects.create_user(username="lead-admin", phone="09120000012", role=User.Role.CONTENT_ADMIN)
        inquiry = Inquiry.objects.create(kind=Inquiry.Kind.CONTRACTOR, contractor=self.contractor, name="مینا", phone="09121234567", message="بازسازی")
        self.client.force_authenticate(admin)
        contacted = self.client.patch(reverse("admin-inquiry-update", kwargs={"pk": inquiry.pk}), {"status": Inquiry.Status.CONTACTED, "follow_up_at": "2026-08-10T12:00:00Z"}, format="json")
        self.assertEqual(contacted.status_code, status.HTTP_200_OK, contacted.data)
        introduced_without_assignment = self.client.patch(reverse("admin-inquiry-update", kwargs={"pk": inquiry.pk}), {"status": Inquiry.Status.INTRODUCED}, format="json")
        self.assertEqual(introduced_without_assignment.status_code, status.HTTP_400_BAD_REQUEST)
        introduced = self.client.patch(reverse("admin-inquiry-update", kwargs={"pk": inquiry.pk}), {"status": Inquiry.Status.INTRODUCED, "assigned_contractor_slug": self.contractor.slug, "admin_note": "برای معرفی آماده است."}, format="json")
        self.assertEqual(introduced.status_code, status.HTTP_200_OK, introduced.data)
        closed = self.client.patch(reverse("admin-inquiry-update", kwargs={"pk": inquiry.pk}), {"status": Inquiry.Status.CLOSED}, format="json")
        self.assertEqual(closed.status_code, status.HTTP_200_OK, closed.data)

    def test_finance_admin_cannot_manage_contractor_leads(self):
        admin = User.objects.create_user(username="finance-market-admin", phone="09120000013", role=User.Role.FINANCE_ADMIN)
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get(reverse("admin-contractor-list")).status_code, status.HTTP_403_FORBIDDEN)

    def test_public_settings_read_does_not_create_database_record(self):
        self.assertFalse(BusinessSettings.objects.exists())
        response = self.client.get(reverse("business-settings"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["brand_name"], "ویلاوان")
        self.assertFalse(response.data["launch_ready"])
        self.assertFalse(BusinessSettings.objects.exists())

    def test_article_list_filters_future_articles_and_supports_categories(self):
        Article.objects.create(
            slug="future-guide",
            title="آینده",
            excerpt="بعداً",
            body="متن",
            category="mazandaran",
            cover_image="/future.jpg",
            status=Article.Status.PUBLISHED,
            published_at=timezone.now() + timedelta(days=1),
        )
        Article.objects.create(
            slug="stay-guide",
            title="اقامت",
            excerpt="راهنمای اقامت",
            body="متن",
            category="stay",
            cover_image="/stay.jpg",
            status=Article.Status.PUBLISHED,
            published_at=timezone.now() - timedelta(days=1),
        )

        response = self.client.get(reverse("article-list"), {"category": "stay"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["slug"] for item in response.data], ["stay-guide"])

    def test_article_detail_returns_safe_html_inline_images_and_related_articles(self):
        self.article.category = Article.Category.LOCAL
        self.article.save(update_fields=["category"])
        article = Article.objects.create(
            slug="safe-guide",
            title="راهنمای امن",
            excerpt="خلاصه راهنما",
            body="## شروع\n\n<script>alert('x')</script>\n\n{{image:forest}}",
            category="guide",
            cover_image="/safe.jpg",
            cover_alt="جنگل مازندران",
            status=Article.Status.PUBLISHED,
            published_at=timezone.now() - timedelta(days=2),
        )
        inline_buffer = BytesIO()
        Image.new("RGB", (800, 450), (20, 60, 50)).save(inline_buffer, format="JPEG")
        ArticleImage.objects.create(article=article, key="forest", image=SimpleUploadedFile("forest.jpg", inline_buffer.getvalue(), content_type="image/jpeg"), alt_text="جنگل مه‌آلود", caption="صبح در جنگل")
        Article.objects.create(
            slug="related-guide",
            title="راهنمای مرتبط",
            excerpt="مرتبط",
            body="متن",
            category="guide",
            cover_image="/related.jpg",
            status=Article.Status.PUBLISHED,
            published_at=timezone.now() - timedelta(days=1),
        )

        response = self.client.get(reverse("article-detail", kwargs={"slug": article.slug}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("body_html", response.data)
        self.assertNotIn("<script", response.data["body_html"])
        self.assertIn("/media/articles/inline/", response.data["body_html"])
        self.assertEqual(response.data["inline_images"][0]["key"], "forest")
        self.assertEqual(response.data["related_articles"][0]["slug"], "related-guide")

    def test_published_article_slug_is_immutable(self):
        article = Article.objects.create(
            slug="stable-guide",
            title="راهنمای پایدار",
            excerpt="خلاصه",
            body="متن",
            cover_image="/stable.jpg",
            cover_alt="تصویر راهنما",
            status=Article.Status.PUBLISHED,
            published_at=timezone.now() - timedelta(days=1),
        )
        article.slug = "changed-guide"

        with self.assertRaises(ValidationError):
            article.save()

        article.slug = "stable-guide"
        article.status = Article.Status.ARCHIVED
        article.save()
        article.slug = "archived-renamed-guide"
        with self.assertRaises(ValidationError):
            article.save()

    def test_published_article_requires_cover_alt_and_existing_inline_images(self):
        article = Article(
            slug="incomplete-guide",
            title="راهنمای ناقص",
            excerpt="خلاصه",
            body="{{image:missing}}",
            cover_image="/cover.jpg",
            status=Article.Status.PUBLISHED,
        )

        with self.assertRaises(ValidationError) as error:
            article.full_clean()

        self.assertIn("cover_alt", error.exception.message_dict)
        self.assertIn("body", error.exception.message_dict)

    def test_article_cta_must_be_same_site_relative_path(self):
        article = Article(
            slug="cta-guide",
            title="راهنمای CTA",
            excerpt="خلاصه",
            body="متن",
            cover_image="/cover.jpg",
            cover_alt="تصویر",
            cta_label="رزرو",
            cta_url="https://evil.example/redirect",
            status=Article.Status.DRAFT,
        )

        with self.assertRaises(ValidationError) as error:
            article.full_clean()

        self.assertIn("cta_url", error.exception.message_dict)

    def test_article_image_rejects_fake_uploads(self):
        article = Article.objects.create(slug="image-parent", title="والد", excerpt="خلاصه", body="متن", cover_image="/cover.jpg", status=Article.Status.DRAFT)
        fake = SimpleUploadedFile("forest.jpg", b"not-an-image", content_type="image/jpeg")
        image = ArticleImage(article=article, key="forest", image=fake, alt_text="جنگل")

        with self.assertRaises(ValidationError):
            image.full_clean()

    def test_article_image_stores_dimensions_for_valid_upload(self):
        buffer = BytesIO()
        Image.new("RGB", (800, 450), (20, 60, 50)).save(buffer, format="JPEG")
        article = Article.objects.create(slug="dimension-parent", title="والد", excerpt="خلاصه", body="متن", cover_image="/cover.jpg", status=Article.Status.DRAFT)
        image = ArticleImage.objects.create(article=article, key="forest", image=SimpleUploadedFile("forest.jpg", buffer.getvalue(), content_type="image/jpeg"), alt_text="جنگل")

        image.refresh_from_db()
        self.assertEqual((image.width, image.height), (800, 450))
