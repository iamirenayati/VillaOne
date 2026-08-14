import math
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from .models import Availability, City, Villa, VillaImage


class VillaAPITests(APITestCase):
    def setUp(self):
        owner = User.objects.create_user(username="owner", phone="09120000001")
        city = City.objects.create(name="سوادکوه")
        self.villa = Villa.objects.create(
            owner=owner,
            city=city,
            slug="khane-meh",
            title="خانه‌ی مه",
            description="اقامتگاه جنگلی",
            capacity=8,
            bedrooms=3,
            price_weekday=18_500_000,
            price_weekend=21_000_000,
            price_holiday=24_000_000,
            status=Villa.Status.PUBLISHED,
        )
        VillaImage.objects.create(villa=self.villa, url="https://example.com/hero.jpg")

    def test_public_villa_list_and_detail(self):
        listing = self.client.get(reverse("villa-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data[0]["slug"], "khane-meh")
        detail = self.client.get(reverse("villa-detail", kwargs={"slug": "khane-meh"}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["capacity"], 8)

    def test_map_endpoint_returns_only_published_villas_with_approximate_coordinates(self):
        self.villa.latitude = 36.463000
        self.villa.longitude = 52.860000
        self.villa.map_radius_meters = 750
        self.villa.save(update_fields=("latitude", "longitude", "map_radius_meters"))
        Villa.objects.create(
            owner=self.villa.owner, city=self.villa.city, slug="draft-map-villa", title="Draft map villa",
            description="Not public", capacity=2, price_weekday=1, price_weekend=1, price_holiday=1,
            latitude=36.4, longitude=52.8, status=Villa.Status.DRAFT,
        )

        first = self.client.get(reverse("villa-map"))
        second = self.client.get(reverse("villa-map"))

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual([item["slug"] for item in first.data], [self.villa.slug])
        self.assertEqual(first.data[0]["map_latitude"], second.data[0]["map_latitude"])
        self.assertEqual(first.data[0]["map_longitude"], second.data[0]["map_longitude"])
        self.assertNotIn("latitude", first.data[0])
        self.assertNotIn("longitude", first.data[0])
        self.assertNotIn("address", first.data[0])

        latitude_distance = (float(first.data[0]["map_latitude"]) - float(self.villa.latitude)) * 111_320
        longitude_distance = (
            (float(first.data[0]["map_longitude"]) - float(self.villa.longitude))
            * 111_320
            * math.cos(math.radians(float(self.villa.latitude)))
        )
        self.assertLessEqual(math.hypot(latitude_distance, longitude_distance), self.villa.map_radius_meters)

    def test_map_endpoint_excludes_coordinate_less_published_villas(self):
        response = self.client.get(reverse("villa-map"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_coordinate_command_updates_only_published_missing_records_and_is_idempotent(self):
        draft = Villa.objects.create(
            owner=self.villa.owner, city=self.villa.city, slug="draft-without-map", title="Draft without map",
            description="Not public", capacity=2, price_weekday=1, price_weekend=1, price_holiday=1,
            status=Villa.Status.DRAFT,
        )
        output = StringIO()
        call_command("populate_map_coordinates", stdout=output)
        self.villa.refresh_from_db()
        draft.refresh_from_db()
        self.assertIsNotNone(self.villa.latitude)
        self.assertIsNotNone(self.villa.longitude)
        self.assertIsNone(draft.latitude)
        original = (self.villa.latitude, self.villa.longitude)

        second_output = StringIO()
        call_command("populate_map_coordinates", stdout=second_output)
        self.villa.refresh_from_db()
        self.assertEqual((self.villa.latitude, self.villa.longitude), original)
        self.assertIn("Updated 0 published villas", second_output.getvalue())

    def test_coordinate_command_makes_every_published_villa_visible_on_map(self):
        second_city = City.objects.create(name="Sari")
        second = Villa.objects.create(
            owner=self.villa.owner,
            city=second_city,
            slug="second-published-map-villa",
            title="Second published map villa",
            description="Published without coordinates",
            capacity=4,
            price_weekday=2,
            price_weekend=2,
            price_holiday=2,
            status=Villa.Status.PUBLISHED,
        )
        Villa.objects.create(
            owner=self.villa.owner,
            city=second_city,
            slug="hidden-draft-map-villa",
            title="Hidden draft map villa",
            description="Draft without coordinates",
            capacity=4,
            price_weekday=2,
            price_weekend=2,
            price_holiday=2,
            status=Villa.Status.DRAFT,
        )

        call_command("populate_map_coordinates", stdout=StringIO())
        response = self.client.get(reverse("villa-map"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["slug"] for item in response.data},
            {self.villa.slug, second.slug},
        )

    @override_settings(DEBUG=True)
    def test_coordinate_command_can_explicitly_refresh_preview_coordinates(self):
        self.villa.latitude = 36.463
        self.villa.longitude = 52.86
        self.villa.save(update_fields=("latitude", "longitude"))

        call_command("populate_map_coordinates", refresh_preview=True, stdout=StringIO())
        self.villa.refresh_from_db()
        refreshed = (self.villa.latitude, self.villa.longitude)

        self.assertNotEqual(refreshed, (36.463, 52.86))
        self.assertGreaterEqual(float(self.villa.latitude), 35.75)
        self.assertLessEqual(float(self.villa.latitude), 36.97)
        self.assertGreaterEqual(float(self.villa.longitude), 50.35)
        self.assertLessEqual(float(self.villa.longitude), 54.2)

        call_command("populate_map_coordinates", refresh_preview=True, stdout=StringIO())
        self.villa.refresh_from_db()
        self.assertEqual((self.villa.latitude, self.villa.longitude), refreshed)

    @override_settings(DEBUG=False)
    def test_coordinate_command_rejects_preview_refresh_outside_local_mode(self):
        with self.assertRaises(CommandError):
            call_command("populate_map_coordinates", refresh_preview=True, stdout=StringIO())

    def test_villa_list_accepts_city_name_or_id(self):
        by_name = self.client.get(reverse("villa-list"), {"city": self.villa.city.name})
        by_id = self.client.get(reverse("villa-list"), {"city": str(self.villa.city_id)})

        self.assertEqual(by_name.status_code, status.HTTP_200_OK)
        self.assertEqual(by_id.status_code, status.HTTP_200_OK)
        self.assertEqual(by_name.data[0]["slug"], self.villa.slug)
        self.assertEqual(by_id.data[0]["slug"], self.villa.slug)

    def test_authenticated_user_can_toggle_and_list_favorites(self):
        guest = User.objects.create_user(username="guest", phone="09120000002")
        self.client.force_authenticate(guest)
        toggle_url = reverse("favorite-toggle", kwargs={"slug": self.villa.slug})

        saved = self.client.post(toggle_url, {}, format="json")
        favorites = self.client.get(reverse("favorite-list"))
        removed = self.client.post(toggle_url, {}, format="json")

        self.assertEqual(saved.status_code, status.HTTP_201_CREATED)
        self.assertTrue(saved.data["saved"])
        self.assertEqual(favorites.data[0]["slug"], self.villa.slug)
        self.assertFalse(removed.data["saved"])

    def test_staff_can_update_availability_and_search_excludes_blocked_day(self):
        admin = User.objects.create_user(username="calendar-admin", phone="09120000003", role=User.Role.SUPER_ADMIN)
        self.client.force_authenticate(admin)
        day = "2026-08-10"
        update = self.client.patch(
            reverse("availability-admin-update", kwargs={"slug": self.villa.slug, "day": day}),
            {"status": Availability.Status.BLOCKED},
            format="json",
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data["status"], Availability.Status.BLOCKED)

        availability = self.client.get(reverse("villa-availability", kwargs={"slug": self.villa.slug}), {"start": day, "end": "2026-08-11"})
        self.assertEqual(availability.data[0]["status"], Availability.Status.BLOCKED)
        search = self.client.get(reverse("villa-list"), {"checkin": day, "checkout": "2026-08-11"})
        self.assertEqual(search.data, [])

    def test_operations_admin_can_update_villa_core_fields(self):
        admin = User.objects.create_user(username="villa-admin", phone="09120000004", role=User.Role.SUPER_ADMIN)
        self.client.force_authenticate(admin)
        response = self.client.patch(
            reverse("villa-admin-update", kwargs={"slug": self.villa.slug}),
            {"title": "خانه مه جدید", "capacity": 10, "price_weekday": 19500000, "deposit_percentage": 40},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.villa.refresh_from_db()
        self.assertEqual(self.villa.title, "خانه مه جدید")
        self.assertEqual(self.villa.capacity, 10)
        self.assertEqual(self.villa.deposit_percentage, 40)
        self.assertEqual(self.villa.description, "اقامتگاه جنگلی")
        self.assertEqual(self.villa.price_weekend, 21_000_000)
        self.assertEqual(self.villa.status, Villa.Status.PUBLISHED)

    def test_content_admin_can_edit_coordinates_but_finance_admin_cannot(self):
        content_admin = User.objects.create_user(username="map-admin", phone="09120000016", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(content_admin)
        allowed = self.client.patch(
            reverse("villa-admin-update", kwargs={"slug": self.villa.slug}),
            {"latitude": "36.463000", "longitude": "52.860000", "map_radius_meters": 900},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data["map_radius_meters"], 900)

        finance_admin = User.objects.create_user(username="map-finance", phone="09120000017", role=User.Role.FINANCE_ADMIN)
        self.client.force_authenticate(finance_admin)
        denied = self.client.patch(
            reverse("villa-admin-update", kwargs={"slug": self.villa.slug}),
            {"map_radius_meters": 1000},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_inventory_includes_drafts_but_public_catalog_does_not(self):
        draft = Villa.objects.create(
            owner=self.villa.owner, city=self.villa.city, slug="draft-villa", title="ویلای پیش‌نویس",
            description="در انتظار انتشار", capacity=4, price_weekday=1, price_weekend=1,
            price_holiday=1, status=Villa.Status.DRAFT,
        )
        admin = User.objects.create_user(username="inventory-admin", phone="09120000014", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(admin)
        inventory = self.client.get(reverse("villa-admin-list"))
        self.client.force_authenticate(None)
        public = self.client.get(reverse("villa-list"))
        self.assertEqual(inventory.status_code, status.HTTP_200_OK)
        self.assertIn(draft.slug, [item["slug"] for item in inventory.data])
        self.assertNotIn(draft.slug, [item["slug"] for item in public.data])

    def test_manual_calendar_cannot_create_fake_booked_day(self):
        admin = User.objects.create_user(username="booked-admin", phone="09120000015", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(admin)
        response = self.client.patch(
            reverse("availability-admin-update", kwargs={"slug": self.villa.slug, "day": "2026-08-12"}),
            {"status": Availability.Status.BOOKED}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Availability.objects.filter(villa=self.villa, date="2026-08-12").exists())

    def test_operations_admin_can_bulk_update_availability_and_price(self):
        admin = User.objects.create_user(username="bulk-admin", phone="09120000005", role=User.Role.SUPER_ADMIN)
        self.client.force_authenticate(admin)
        bulk = self.client.post(reverse("availability-admin-bulk-update", kwargs={"slug": self.villa.slug}), {"days": ["2026-08-10", "2026-08-11"], "status": Availability.Status.BLOCKED}, format="json")
        self.assertEqual(bulk.status_code, status.HTTP_200_OK)
        self.assertEqual(Availability.objects.filter(villa=self.villa, status=Availability.Status.BLOCKED).count(), 2)
        price = self.client.patch(reverse("price-override-admin-update", kwargs={"slug": self.villa.slug, "date": "2026-08-10"}), {"price": 22000000}, format="json")
        self.assertEqual(price.status_code, status.HTTP_200_OK)
        self.assertEqual(str(price.data["price"]), "22000000")


class RealVillaImportCommandTests(APITestCase):
    def _write_image(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (960, 640), color=(54, 91, 72)).save(path, "JPEG")

    def test_import_replaces_public_demo_inventory_with_real_uploaded_villas(self):
        owner = User.objects.create_user(username="import-owner", phone="09120000099")
        city = City.objects.create(name="Sari")
        demo = Villa.objects.create(
            owner=owner,
            city=city,
            slug="khane-meh",
            title="Demo villa",
            description="Demo",
            capacity=2,
            price_weekday=1,
            price_weekend=1,
            price_holiday=1,
            status=Villa.Status.PUBLISHED,
        )

        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as media_root:
            source = Path(directory)
            villa = source / "1"
            self._write_image(villa / "Cover" / "cover.jpg")
            self._write_image(villa / "gallery.jpg")
            (villa / "Description data").mkdir(parents=True)
            (villa / "Description data" / "desc.txt").write_text("Real villa description", encoding="utf-8")

            with override_settings(MEDIA_ROOT=media_root):
                call_command("import_real_villas", source=str(source), stdout=StringIO())

            imported = Villa.objects.get(slug="real-villa-01")
            demo.refresh_from_db()

        self.assertEqual(imported.status, Villa.Status.PUBLISHED)
        self.assertEqual(imported.description, "Real villa description")
        self.assertTrue(imported.images.filter(order=0, uploaded_image__isnull=False).exists())
        self.assertGreaterEqual(imported.images.count(), 2)
        self.assertEqual(demo.status, Villa.Status.DRAFT)
