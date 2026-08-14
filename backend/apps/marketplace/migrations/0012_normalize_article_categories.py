from django.db import migrations


def normalize_articles(apps, schema_editor):
    Article = apps.get_model("marketplace", "Article")
    category_map = {
        "راهنمای سفر": "guide",
        "اقامت و ویلا": "stay",
        "معماری و بازسازی": "design",
        "ملک و سرمایه‌گذاری": "property",
        "ملک و سرمایه\u200cگذاری": "property",
        "تجربه و خدمات محلی": "local",
    }
    for source, target in category_map.items():
        Article.objects.filter(category=source).update(category=target)
    Article.objects.filter(slug="villa-buying-guide-mazandaran").update(status="draft", published_at=None)


class Migration(migrations.Migration):
    dependencies = [("marketplace", "0011_article_cover_alt_article_cta_label_article_cta_url_and_more")]
    operations = [migrations.RunPython(normalize_articles, migrations.RunPython.noop)]
