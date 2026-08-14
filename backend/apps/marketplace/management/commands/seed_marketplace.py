from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.marketplace.models import Article, Contractor, RealEstateListing, ServiceOffer


ARTICLE_BODY = """خرید ویلا در شمال بیش از انتخاب یک ساختمان زیباست. کیفیت دسترسی، سند، بافت محله و هزینه نگهداری می‌توانند ارزش واقعی ملک را تغییر دهند.

## اول از هدف خرید شروع کنید

اگر هدف شما استفاده خانوادگی است، زمان رانندگی، آرامش محله و دسترسی روزمره مهم‌تر از بازده اجاره کوتاه‌مدت خواهد بود. برای سرمایه‌گذاری، نقدشوندگی منطقه، کیفیت سند و امکان مدیریت حرفه‌ای ملک را جدی‌تر بررسی کنید.

## سند و وضعیت حقوقی را مستقل بررسی کنید

پیش از هر پرداخت، نوع سند، حدود زمین، کاربری، پایان‌کار و بدهی‌های احتمالی باید توسط کارشناس حقوقی مستقل بررسی شود. تصاویر و توضیحات آنلاین جای استعلام رسمی را نمی‌گیرند.

## هزینه واقعی مالکیت را حساب کنید

علاوه بر قیمت خرید، هزینه نگهداری باغ و استخر، امنیت، تعمیرات رطوبتی، بیمه و رفت‌وآمد را در بودجه سالانه قرار دهید. ویلایی که ارزان‌تر به نظر می‌رسد ممکن است هزینه نگهداری بیشتری داشته باشد.

## بازدید را در دو زمان انجام دهید

ملک را یک‌بار در روشنایی روز و یک‌بار پس از بارندگی یا در ساعات شلوغ مسیر ببینید. این کار وضعیت نور، رطوبت، زهکشی، سروصدا و دسترسی واقعی را بهتر نشان می‌دهد.

ویلاوان در این مرحله فروشنده ملک نیست؛ درخواست شما را ثبت می‌کند تا تیم محلی برای بازدید، بررسی اولیه و معرفی متخصص مناسب با شما تماس بگیرد."""


STUDIO_SHOMAL_CATALOG = [
    {
        "type": "project",
        "image": "/images/villas/villa-01.jpg",
        "title": "ویلای جنگلی یک‌طبقه",
        "subtitle": "آرام، کاربردی و هماهنگ با اقلیم شمال",
        "description": "طراحی و اجرای ویلای یک‌طبقه برای زمین‌های جنگلی و باغی، با پلان منعطف و نورگیری عمیق.",
        "area": "۱۲۰ تا ۱۸۰ مترمربع",
        "price_from": 15_000_000_000,
        "price_to": 28_000_000_000,
        "timeline": "۸ تا ۱۲ ماه",
        "price_note": "بدون احتساب زمین، مجوز و انشعابات خارج از ملک",
        "scope": "طراحی، اجرای سازه، تأسیسات، نما و تحویل فضای داخلی پایه",
        "ideal_for": "زمین‌های باغی و جنگلی با دسترسی مناسب برای خانواده‌های چهار تا هشت نفره",
        "deliverables": ["پلان و نما", "نقشه سازه و تأسیسات", "اجرای کامل پوسته ساختمان", "تحویل مرحله‌ای"],
        "materials": ["اسکلت بتنی یا فلزی", "نمای چوب و سیمان شسته", "پنجره دوجداره", "کف‌سازی مقاوم رطوبت"],
        "features": ["طراحی معماری", "سازه و تأسیسات", "نمای ماندگار", "نظارت اجرا"],
    },
    {
        "type": "project",
        "image": "/images/villas/villa-05.jpg",
        "title": "ویلای مدرن دوطبقه",
        "subtitle": "چشم‌انداز باز، پلان مهمان‌پذیر",
        "description": "پروژه کامل ویلای مدرن با تراس، فضای نشیمن باز و امکان طراحی استخر و محوطه اختصاصی.",
        "area": "۱۸۰ تا ۳۲۰ مترمربع",
        "price_from": 27_000_000_000,
        "price_to": 52_000_000_000,
        "timeline": "۱۰ تا ۱۶ ماه",
        "price_note": "وابسته به سطح شیشه، تأسیسات هوشمند و جزئیات نما",
        "scope": "طراحی کامل، اجرای سازه و معماری، تراس، روف‌گاردن و آماده‌سازی استخر",
        "ideal_for": "پروژه‌های شاخص خانوادگی یا اقامتگاه‌های کوچک با ظرفیت بالاتر",
        "deliverables": ["کانسپت و مدل سه‌بعدی", "دفترچه جزئیات اجرایی", "مدیریت پیمان", "کنترل کیفیت و تحویل"],
        "materials": ["شیشه قدی دوجداره", "نمای سنگ و چوب ترمو", "تأسیسات گرمایش از کف", "یراق‌آلات و شیرآلات رده حرفه‌ای"],
        "features": ["طراحی و مدل‌سازی سه‌بعدی", "اجرای کامل", "تراس و روف‌گاردن", "تحویل مرحله‌ای"],
    },
    {
        "type": "project",
        "image": "/images/villas/villa-03.jpg",
        "title": "کلبه چوبی و A-frame",
        "subtitle": "جمع‌وجور، گرم و مناسب زمین‌های جنگلی",
        "description": "ساخت کلبه چوبی با جزئیات سفارشی، عایق‌کاری مناسب رطوبت و امکان اجرای مبلمان داخلی هماهنگ.",
        "area": "۶۰ تا ۱۲۰ مترمربع",
        "price_from": 9_500_000_000,
        "price_to": 19_000_000_000,
        "timeline": "۵ تا ۸ ماه",
        "price_note": "بازه قیمت با نوع چوب، عایق و سطح دکوراسیون تغییر می‌کند",
        "scope": "طراحی، ساخت سازه چوبی، عایق‌کاری، نصب تأسیسات و دکوراسیون داخلی پایه",
        "ideal_for": "زمین‌های جنگلی کوچک، اقامت آخر هفته و پروژه‌های بوتیک گردشگری",
        "deliverables": ["طراحی پلان و پوسته", "ساخت و نصب سازه", "آب‌بندی و عایق‌کاری", "تحویل آماده بهره‌برداری"],
        "materials": ["چوب اشباع‌شده", "عایق پشم‌سنگ", "پوشش ضدحریق", "کف و کابینت چوبی"],
        "features": ["سازه چوبی", "عایق‌کاری اقلیمی", "گرمایش و سرمایش", "دکوراسیون داخلی"],
    },
    {
        "type": "product",
        "image": "/images/villas/villa-02.jpg",
        "title": "طراحی معماری و نقشه اجرایی",
        "subtitle": "از ایده تا نقشه قابل اجرا",
        "description": "جلسه نیازسنجی، طراحی پلان، نما و نقشه‌های اجرایی برای شروع مطمئن پروژه.",
        "price_from": 850_000_000,
        "price_to": 2_400_000_000,
        "timeline": "۳ تا ۶ هفته",
        "price_note": "قیمت بر اساس زیربنا و سطح جزئیات نقشه تعیین می‌شود",
        "scope": "جلسه نیازسنجی، برداشت اطلاعات زمین، طراحی پلان، نما و نقشه‌های اجرایی",
        "ideal_for": "مالکانی که پیش از شروع ساخت به نقشه و برآورد قابل اتکا نیاز دارند",
        "deliverables": ["پلان‌های معماری", "نما و برش‌ها", "مدل سه‌بعدی", "فهرست اولیه مصالح"],
        "materials": ["پکیج نقشه PDF", "فایل‌های اجرایی", "رندرهای انتخابی", "جلسه تحویل و توضیح"],
        "features": ["پلان و نما", "مدل سه‌بعدی", "نقشه‌های اجرایی", "برآورد اولیه"],
    },
    {
        "type": "product",
        "image": "/images/villas/villa-04.jpg",
        "title": "محوطه‌سازی و استخر",
        "subtitle": "باغی که ادامه ویلای شماست",
        "description": "طراحی و اجرای محوطه، زهکشی، نورپردازی و استخر متناسب با زمین و پوشش گیاهی منطقه.",
        "price_from": 3_500_000_000,
        "price_to": 12_000_000_000,
        "timeline": "۲ تا ۵ ماه",
        "price_note": "پس از بررسی شیب زمین، دسترسی ماشین‌آلات و ابعاد استخر قطعی می‌شود",
        "scope": "طراحی محوطه، زهکشی، مسیرسازی، فضای سبز، نورپردازی و اجرای استخر",
        "ideal_for": "ویلاهایی که می‌خواهند فضای بیرونی را به بخش اصلی تجربه اقامت تبدیل کنند",
        "deliverables": ["پلان محوطه", "اجرای زیرسازی و زهکشی", "کاشت و نورپردازی", "تست و تحویل استخر"],
        "materials": ["سنگ بومی", "چوب فضای باز", "پمپ و تجهیزات تصفیه", "چراغ‌های کم‌مصرف ضدآب"],
        "features": ["طراحی مسیر و باغ", "زهکشی", "استخر", "نورپردازی شب"],
    },
]


class Command(BaseCommand):
    help = "Creates local-only marketplace fixtures. Use --publish only for an intentional local preview."

    def add_arguments(self, parser):
        parser.add_argument("--publish", action="store_true", help="Publish fixtures for an intentional local preview.")

    def handle(self, *args, **options):
        fixture_status = "published" if options["publish"] else "draft"
        RealEstateListing.objects.update_or_create(slug="royan-garden-villa", defaults={"title": "ویلای باغ روشن در رویان", "city": "رویان", "neighborhood": "حومه جنگلی", "property_type": "villa", "price": 18_900_000_000, "area_m2": 620, "bedrooms": 4, "description": "ویلایی آرام با باغ بالغ، دسترسی آسفالته و فاصله کوتاه تا خدمات شهری؛ مناسب استفاده خانوادگی و اقامت چهارفصل.", "features": ["سند تک‌برگ", "باغ ۴۲۰ متری", "استخر سرپوشیده", "دسترسی آسفالته"], "cover_image": "/images/villas/villa-05.jpg", "is_featured": True, "status": "published"})
        RealEstateListing.objects.update_or_create(slug="savadkuh-forest-house", defaults={"title": "خانه جنگلی سوادکوه", "city": "سوادکوه", "neighborhood": "لفور", "property_type": "villa", "price": 12_600_000_000, "area_m2": 480, "bedrooms": 3, "description": "خانه‌ای بازسازی‌شده در بافت سبز لفور با حریم خصوصی مناسب و چشم‌انداز دائمی جنگل.", "features": ["سند رسمی", "بازسازی کامل", "چشم‌انداز جنگل", "آب و برق مستقل"], "cover_image": "/images/villas/villa-08.jpg", "status": "published"})
        RealEstateListing.objects.update_or_create(slug="sari-citrus-land", defaults={"title": "زمین باغی نزدیک ساری", "city": "ساری", "neighborhood": "دودانگه", "property_type": "land", "price": 8_400_000_000, "area_m2": 1200, "bedrooms": 0, "description": "قطعه باغ مرکبات با مسیر دسترسی مناسب و ظرفیت بررسی برای ساخت مجموعه اقامتی کوچک.", "features": ["۱۲۰۰ متر", "باغ مرکبات", "دسترسی خودرو", "انشعابات نزدیک"], "cover_image": "/images/villas/villa-06.jpg", "status": "published"})

        Contractor.objects.update_or_create(slug="studio-shomal", defaults={"name": "استودیو معماری شمال", "specialty": "معماری و بازسازی ویلا", "city": "ساری", "years_experience": 11, "description": "تیم طراحی و اجرای پروژه‌های ویلایی با تمرکز بر اقلیم مرطوب، مصالح ماندگار و مدیریت شفاف هزینه.", "services": ["طراحی معماری", "بازسازی کامل", "طراحی داخلی", "نظارت اجرا"], "catalog": STUDIO_SHOMAL_CATALOG, "cover_image": "/images/villas/villa-01.jpg", "verified": True, "featured": True, "status": "published"})
        Contractor.objects.update_or_create(slug="sabz-bana", defaults={"name": "سبز بنا مازندران", "specialty": "محوطه‌سازی و استخر", "city": "قائم‌شهر", "years_experience": 8, "description": "اجرای باغ، زهکشی، استخر و فضای بیرونی متناسب با بارندگی و پوشش گیاهی شمال.", "services": ["محوطه‌سازی", "ساخت استخر", "زهکشی", "نورپردازی باغ"], "cover_image": "/images/villas/villa-04.jpg", "verified": True, "featured": False, "status": "published"})
        Contractor.objects.update_or_create(slug="choob-o-meh", defaults={"name": "چوب و مه", "specialty": "سازه چوبی و دکوراسیون", "city": "سوادکوه", "years_experience": 7, "description": "طراحی و اجرای سازه‌های چوبی، پرگولا و فضای داخلی گرم برای ویلاهای جنگلی.", "services": ["پرگولا", "نمای چوب", "کابینت", "دکوراسیون داخلی"], "cover_image": "/images/villas/villa-03.jpg", "verified": True, "featured": False, "status": "published"})

        services = [
            ("local-breakfast", "صبحانه محلی ویلا", "پذیرایی", "صبحانه گرم با نان و پنیر محلی، مربا و چای برای شروع آرام روز.", "۸۵۰ هزار تومان برای دو نفر", 850000, "/images/villas/villa-02.jpg", ["تحویل در ویلا", "مواد تازه محلی"]),
            ("forest-photography", "عکاسی سفر و ویلا", "تجربه", "یک جلسه عکاسی سبک و طبیعی از اقامت، خانواده یا فضای ویلا.", "۴.۵ میلیون تومان برای یک جلسه", 4500000, "/images/villas/experience.jpg", ["عکاس محلی", "تحویل فایل منتخب"]),
            ("private-spa", "ماساژ و ریلکس خصوصی", "سلامت", "هماهنگی متخصص برای ماساژ آرامش‌بخش در فضای اقامتگاه.", "۱.۸ میلیون تومان برای یک جلسه", 1800000, "/images/villas/villa-04.jpg", ["اعزام به ویلا", "رزرو قبلی"]),
            ("mazandaran-day-tour", "تور یک‌روزه مازندران", "گردش", "مسیر اختصاصی با راننده محلی برای آبشار، جنگل، بازار و غذاهای بومی.", "۶.۵ میلیون تومان برای خودرو", 6500000, "/images/villas/villa-08.jpg", ["راننده محلی", "برنامه منعطف"]),
        ]
        for slug, title, category, description, price_note, base_price, cover_image, features in services:
            ServiceOffer.objects.update_or_create(slug=slug, defaults={"title": title, "category": category, "description": description, "price_note": price_note, "base_price": base_price, "cover_image": cover_image, "features": features, "status": "published"})

        Article.objects.update_or_create(slug="villa-buying-guide-mazandaran", defaults={"title": "راهنمای خرید ویلا در مازندران؛ پنج بررسی پیش از تصمیم", "excerpt": "از سند و کاربری تا رطوبت، دسترسی و هزینه نگهداری؛ نکاتی که پیش از بازدید و پرداخت باید بدانید.", "body": ARTICLE_BODY, "category": "property", "author_name": "تحریریه ویلاوان", "cover_image": "/images/villas/experience.jpg", "cover_alt": "چشم‌انداز ویلایی در مازندران", "published_at": timezone.now() if options["publish"] else None, "status": fixture_status})
        if fixture_status != "published":
            RealEstateListing.objects.filter(slug__in=["royan-garden-villa", "savadkuh-forest-house", "sari-citrus-land"]).update(status=fixture_status)
            Contractor.objects.filter(slug__in=["studio-shomal", "sabz-bana", "choob-o-meh"]).update(status=fixture_status)
            ServiceOffer.objects.filter(slug__in=[slug for slug, *_ in services]).update(status=fixture_status)
        self.stdout.write(self.style.SUCCESS(f"Marketplace local fixtures created as {fixture_status}."))
