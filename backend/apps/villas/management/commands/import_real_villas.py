from decimal import Decimal
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from PIL import Image, UnidentifiedImageError

from apps.accounts.models import User
from apps.villas.models import Amenity, City, Villa, VillaImage


DEMO_SLUGS = {
    "khane-meh", "villa-orosi", "emarat-narenj", "khane-roshana", "bagh-safid",
    "chalet-abr", "villa-sarv", "emarat-ayeneh", "khane-baroon", "villa-rood",
}

DEFAULT_CANCELLATION_POLICY = {
    "more_than_7_days": 90,
    "between_3_and_7_days": 50,
    "less_than_3_days": 0,
}

# Values marked as estimates are deliberately approximate operational defaults. They can be
# refined in Django Admin without changing the imported photos or written descriptions.
REAL_VILLAS = {
    "1": {
        "title": "کلبه جنگلی زیرباب شیرگاه", "city": "شیرگاه", "price": 4_500_000,
        "capacity": 9, "bedrooms": 3, "beds": 4, "bathrooms": 2,
        "tags": ["forest", "mountain"], "amenities": ["پارکینگ", "اینترنت", "منظره جنگل"],
        "coordinates": ("36.296200", "52.887400"), "featured": True,
        "fallback_description": "کلبه‌ای دربست در نزدیکی زیرباب شیرگاه با فضای دنج جنگلی، سه اتاق خواب، پارکینگ روباز و دسترسی مناسب به سوپرمارکت و نانوایی. این اقامتگاه برای سفرهای خانوادگی و گروه‌های کوچک مناسب است.",
    },
    "2": {
        "title": "ویلای جنگلی استخردار لفور", "city": "سوادکوه", "price": 5_500_000,
        "capacity": 14, "bedrooms": 3, "beds": 4, "bathrooms": 2,
        "tags": ["forest", "pool"], "amenities": ["استخر سرپوشیده", "پارکینگ", "منظره جنگل"],
        "coordinates": ("36.216900", "52.842400"), "featured": True,
        "fallback_description": "ویلایی دربست در دل جنگل‌های لفور با فضای باز، سه اتاق خواب و ظرفیت مناسب برای جمع‌های خانوادگی.",
    },
    "3": {
        "title": "کلبه سوئیسی افرای شیرگاه", "city": "شیرگاه", "price": 2_500_000,
        "capacity": 6, "bedrooms": 2, "beds": 4, "bathrooms": 1,
        "tags": ["forest", "countryside"], "amenities": ["پارکینگ", "آشپزخانه", "منظره جنگل"],
        "coordinates": ("36.283900", "52.901800"), "featured": False,
        "fallback_description": "کلبه سوئیسی دوخوابه در طبیعت روستایی شیرگاه، مناسب سفرهای خانوادگی و اقامتی آرام در نزدیکی جنگل.",
    },
    "4": {
        "title": "ویلای دوبلکس استخردار فرح‌آباد", "city": "ساری", "price": 5_000_000,
        "capacity": 6, "bedrooms": 2, "beds": 2, "bathrooms": 2,
        "tags": ["pool", "beach"], "amenities": ["استخر سرپوشیده", "روف گاردن", "پارکینگ", "اینترنت"],
        "coordinates": ("36.809600", "53.048200"), "featured": True,
        "fallback_description": "ویلای دوبلکس دوخوابه در فرح‌آباد با استخر سرپوشیده آب‌گرم، روف‌گاردن و دسترسی مناسب به ساحل و امکانات روزانه.",
    },
    "5": {
        "title": "کلبه چوبی استخردار وسطی‌کلا", "city": "قائم‌شهر", "price": 4_210_000,
        "capacity": 10, "bedrooms": 1, "beds": 3, "bathrooms": 2,
        "tags": ["pool", "countryside"], "amenities": ["استخر سرپوشیده", "تراس", "باربیکیو", "پارکینگ"],
        "coordinates": ("36.448600", "52.826500"), "featured": True,
        "fallback_description": "کلبه چوبی یک‌خوابه در وسطی‌کلا قائم‌شهر با استخر سرپوشیده، تراس، ایوان و حیاط خصوصی.",
    },
    "6": {
        "title": "ویلای چوبی استخردار شارقلت لفور", "city": "شیرگاه", "price": 7_500_000,
        "capacity": 6, "bedrooms": 2, "beds": 5, "bathrooms": 2,
        "tags": ["forest", "pool"], "amenities": ["استخر سرپوشیده", "حوضچه آب‌گرم", "بالکن", "پارکینگ"],
        "coordinates": ("36.248700", "52.823900"), "featured": False,
        "fallback_description": "ویلای دوبلکس دوخوابه با طراحی داخلی چوبی، استخر سرپوشیده و حوضچه آب‌گرم در روستای شارقلت لفور.",
    },
    "7": {
        "title": "ویلای دوبلکس مدرن جاده پلاژ", "city": "ساری", "price": 5_000_000,
        "capacity": 6, "bedrooms": 2, "beds": 3, "bathrooms": 2,
        "tags": ["pool", "beach"], "amenities": ["استخر سرپوشیده", "پارکینگ", "اینترنت", "طراحی مدرن"],
        "coordinates": ("36.577300", "53.003900"), "featured": False,
        "fallback_description": "ویلای دوبلکس نوساز با طراحی مدرن و مینیمال، دسترسی آسان به امکانات و فاصله کوتاه تا دریا.",
    },
    "8": {
        "title": "ویلای تریپلکس استخردار ساری", "city": "ساری", "price": 6_500_000,
        "capacity": 6, "bedrooms": 2, "beds": 3, "bathrooms": 2,
        "tags": ["pool", "beach"], "amenities": ["استخر سرپوشیده", "باربیکیو", "فوتبال دستی", "پارکینگ"],
        "coordinates": ("36.590800", "53.018600"), "featured": False,
        "fallback_description": "ویلای تریپلکس نوساز در ساری با استخر سرپوشیده آب‌گرم، باربیکیو و فضای مناسب برای جمع‌های کوچک.",
    },
    "9": {
        "title": "ویلای سوئیسی کنار رودخانه لفور", "city": "سوادکوه", "price": 6_500_000,
        "capacity": 8, "bedrooms": 2, "beds": 3, "bathrooms": 2,
        "tags": ["forest", "riverside", "pool"], "amenities": ["استخر سرپوشیده", "تراس", "میز بیلیارد", "پارکینگ"],
        "coordinates": ("36.230600", "52.835100"), "featured": False,
        "fallback_description": "ویلای طرح سوئیسی در کنار رودخانه لفور با دو اتاق خواب، تراس رو به جنگل و رودخانه، استخر سرپوشیده و پارکینگ.",
    },
    "10": {
        "title": "ویلای مدرن استخردار مازندران", "city": "ساری", "price": 5_500_000,
        "capacity": 6, "bedrooms": 2, "beds": 3, "bathrooms": 2,
        "tags": ["pool", "countryside"], "amenities": ["استخر سرپوشیده", "میز بیلیارد", "فوتبال دستی", "پارکینگ"],
        "coordinates": ("36.552100", "53.071400"), "featured": False,
        "fallback_description": "ویلای دوبلکس نوساز با طراحی مدرن، استخر سرپوشیده آب‌گرم، میز بیلیارد و دسترسی پیاده به امکانات رفاهی.",
    },
    "11": {
        "title": "ویلای منتخب قائم‌شهر", "city": "قائم‌شهر", "price": 4_500_000,
        "capacity": 4, "bedrooms": 2, "beds": 2, "bathrooms": 1,
        "tags": ["garden", "countryside"], "amenities": ["پارکینگ", "آشپزخانه", "حیاط"],
        "coordinates": ("36.470900", "52.875300"), "featured": False,
        "fallback_description": "اقامتگاهی منتخب در قائم‌شهر. اطلاعات تکمیلی اقامتگاه پیش از نهایی‌کردن رزرو با مهمان هماهنگ می‌شود.",
    },
    "12": {
        "title": "کلبه سوئیسی استخردار تمشک", "city": "شیرگاه", "price": 4_800_000,
        "capacity": 6, "bedrooms": 2, "beds": 3, "bathrooms": 1,
        "tags": ["forest", "riverside", "pool"], "amenities": ["استخر روباز", "بالکن", "آتشدان", "پارکینگ"],
        "coordinates": ("36.271300", "52.891600"), "featured": False,
        "fallback_description": "کلبه سوئیسی دوخوابه با استخر روباز آب‌گرم، بالکن رو به رودخانه و فضای مناسب برای اقامت در طبیعت.",
    },
    "13": {
        "title": "کلبه ماهسو بابل‌کنار", "city": "شیرگاه", "price": 2_500_000,
        "capacity": 6, "bedrooms": 2, "beds": 3, "bathrooms": 2,
        "tags": ["forest", "countryside"], "amenities": ["ایوان", "پارکینگ", "آشپزخانه", "حیاط"],
        "coordinates": ("36.330700", "52.811500"), "featured": False,
        "fallback_description": "کلبه سوئیسی دوخوابه در بالفکلا شرقی بابل‌کنار با ایوان، حیاط محصور و دسترسی نزدیک به فروشگاه‌های محلی.",
    },
}


class Command(BaseCommand):
    help = "Imports approved local villa data and retires legacy demo listings from the public catalog."

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Absolute or relative path to the VillaData-Temp folder.")

    def _validated_image(self, path):
        try:
            with Image.open(path) as image:
                image.verify()
        except (OSError, UnidentifiedImageError) as error:
            raise CommandError(f"Invalid image file: {path}") from error

    def _save_image(self, villa, path, order):
        filename = f"{villa.slug}-{order}-{path.name.replace(' ', '-') }"
        image, _ = VillaImage.objects.get_or_create(
            villa=villa,
            order=order,
            defaults={"alt_text": villa.title},
        )
        image.alt_text = villa.title
        if not image.uploaded_image or not image.uploaded_image.name.endswith(filename):
            self._validated_image(path)
            with path.open("rb") as source:
                image.uploaded_image.save(filename, File(source), save=False)
        image.url = ""
        image.save()

    def handle(self, *args, **options):
        source = Path(options["source"]).resolve()
        if not source.is_dir():
            raise CommandError(f"Source folder does not exist: {source}")

        owner, _ = User.objects.get_or_create(
            phone="09120000001",
            defaults={"username": "09120000001", "first_name": "مالک", "last_name": "ویلاوان", "role": User.Role.OWNER},
        )
        retired = Villa.objects.filter(slug__in=DEMO_SLUGS).exclude(status=Villa.Status.DRAFT).update(
            status=Villa.Status.DRAFT,
            featured=False,
        )
        imported = 0

        for folder_name, data in REAL_VILLAS.items():
            folder = source / folder_name
            if not folder.is_dir():
                self.stdout.write(self.style.WARNING(f"Skipped missing folder: {folder_name}"))
                continue

            city, _ = City.objects.get_or_create(name=data["city"])
            description_path = folder / "Description data" / "desc.txt"
            description = description_path.read_text(encoding="utf-8").strip() if description_path.exists() else data["fallback_description"]
            amenities = [Amenity.objects.get_or_create(name=name)[0] for name in data["amenities"]]
            latitude, longitude = data["coordinates"]
            villa, _ = Villa.objects.update_or_create(
                slug=f"real-villa-{int(folder_name):02d}",
                defaults={
                    "owner": owner,
                    "city": city,
                    "title": data["title"],
                    "description": description,
                    "latitude": Decimal(latitude),
                    "longitude": Decimal(longitude),
                    "map_radius_meters": 1800,
                    "setting_tags": data["tags"],
                    "bedrooms": data["bedrooms"],
                    "beds": data["beds"],
                    "bathrooms": data["bathrooms"],
                    "capacity": data["capacity"],
                    "price_weekday": data["price"],
                    "price_weekend": int(data["price"] * 1.15),
                    "price_holiday": int(data["price"] * 1.30),
                    "deposit_percentage": 30,
                    "cancellation_policy": DEFAULT_CANCELLATION_POLICY,
                    "is_instant_bookable": False,
                    "requires_id_verification": True,
                    "status": Villa.Status.PUBLISHED,
                    "featured": data["featured"],
                },
            )
            villa.amenities.set(amenities)

            cover_directory = folder / "Cover"
            cover = next(iter(sorted(cover_directory.glob("*.jpg"))), None) if cover_directory.is_dir() else None
            if cover:
                self._save_image(villa, cover, 0)

            gallery = [path for path in sorted(folder.glob("*.jpg")) if not cover or path.name != cover.name]
            for order, image_path in enumerate(gallery, start=1):
                self._save_image(villa, image_path, order)
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported {imported} real villas and retired {retired} demo listings."))
