from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.villas.models import Amenity, City, Villa, VillaImage


DEMO_VILLAS = [
    ("khane-meh", "خانه‌ی مه", "سوادکوه", 18_500_000, 8, 3, ["forest", "mountain"], "/images/villas/villa-08.jpg"),
    ("villa-orosi", "ویلای اُرُسی", "شیرگاه", 15_800_000, 6, 2, ["forest", "riverside"], "/images/villas/villa-02.jpg"),
    ("emarat-narenj", "عمارت نارنج", "ساری", 22_000_000, 10, 4, ["countryside", "garden"], "/images/villas/villa-05.jpg"),
    ("khane-roshana", "خانه روشنـا", "قائم‌شهر", 12_400_000, 6, 2, ["countryside", "garden"], "/images/villas/villa-06.jpg"),
    ("bagh-safid", "باغ سفید", "ساری", 19_600_000, 8, 3, ["garden", "countryside"], "/images/villas/villa-04.jpg"),
    ("chalet-abr", "شاله ابر", "سوادکوه", 14_900_000, 4, 2, ["mountain", "forest"], "/images/villas/villa-03.jpg"),
    ("villa-sarv", "ویلای سرو", "شیرگاه", 17_200_000, 8, 3, ["forest", "riverside"], "/images/villas/villa-07.jpg"),
    ("emarat-ayeneh", "عمارت آینه", "قائم‌شهر", 24_500_000, 12, 5, ["garden", "countryside"], "/images/villas/villa-01.jpg"),
    ("khane-baroon", "خانه باران", "سوادکوه", 13_600_000, 6, 2, ["forest", "mountain"], "/images/villas/villa-02.jpg"),
    ("villa-rood", "ویلای رود", "شیرگاه", 20_800_000, 10, 4, ["riverside", "forest"], "/images/villas/villa-08.jpg"),
]


class Command(BaseCommand):
    help = "Creates local-only fixture inventory. Use --publish only for a deliberate preview."

    def add_arguments(self, parser):
        parser.add_argument("--publish", action="store_true", help="Publish fixtures for an intentional local preview.")

    def handle(self, *args, **options):
        status = Villa.Status.PUBLISHED if options["publish"] else Villa.Status.DRAFT
        owner, _ = User.objects.get_or_create(
            phone="09120000001",
            defaults={"username": "09120000001", "first_name": "مالک", "last_name": "نمونه", "role": User.Role.OWNER},
        )
        amenities = [Amenity.objects.get_or_create(name=name)[0] for name in ["استخر اختصاصی", "پارکینگ", "اینترنت", "باربیکیو"]]
        for index, (slug, title, city_name, price, capacity, bedrooms, setting_tags, image_url) in enumerate(DEMO_VILLAS):
            city, _ = City.objects.get_or_create(name=city_name)
            villa, _ = Villa.objects.update_or_create(
                slug=slug,
                defaults={
                    "owner": owner,
                    "city": city,
                    "title": title,
                    "description": f"{title}، اقامتگاهی دست‌چین‌شده توسط ویلاوان.",
                    "capacity": capacity,
                    "bedrooms": bedrooms,
                    "beds": bedrooms + 2,
                    "bathrooms": max(2, bedrooms),
                    "price_weekday": price,
                    "price_weekend": int(price * 1.15),
                    "price_holiday": int(price * 1.3),
                    "status": status,
                    "featured": index < 4,
                    "is_instant_bookable": index % 3 == 1,
                    "setting_tags": setting_tags,
                    "cancellation_policy": {"more_than_7_days": 90, "between_3_and_7_days": 50, "less_than_3_days": 0},
                },
            )
            villa.amenities.set(amenities if index % 4 != 2 else amenities[1:])
            VillaImage.objects.update_or_create(villa=villa, order=0, defaults={"url": image_url, "alt_text": title})
        self.stdout.write(self.style.SUCCESS(f"VillaOne local fixtures created as {status}."))
