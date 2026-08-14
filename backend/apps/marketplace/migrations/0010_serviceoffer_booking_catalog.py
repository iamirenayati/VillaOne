import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0009_businesssettings_card_transfer_bank_name_and_more"),
        ("villas", "0003_villaimage_uploaded_image_alter_villaimage_url"),
    ]

    operations = [
        migrations.AlterModelOptions(name="serviceoffer", options={"ordering": ["sort_order", "-featured", "category", "title"]}),
        migrations.AddField(model_name="serviceoffer", name="cancellation_text", field=models.TextField(blank=True)),
        migrations.AddField(model_name="serviceoffer", name="default_daily_capacity", field=models.PositiveSmallIntegerField(default=1)),
        migrations.AddField(model_name="serviceoffer", name="eligible_villas", field=models.ManyToManyField(blank=True, related_name="eligible_services", to="villas.villa")),
        migrations.AddField(model_name="serviceoffer", name="exclusions", field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name="serviceoffer", name="featured", field=models.BooleanField(db_index=True, default=False)),
        migrations.AddField(model_name="serviceoffer", name="fulfillment_mode", field=models.CharField(choices=[("bookable", "قابل رزرو"), ("inquiry_only", "فقط درخواست هماهنگی"), ("both", "رزرو یا هماهنگی")], db_index=True, default="bookable", max_length=16)),
        migrations.AddField(model_name="serviceoffer", name="inclusions", field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name="serviceoffer", name="maximum_quantity", field=models.PositiveSmallIntegerField(default=1)),
        migrations.AddField(model_name="serviceoffer", name="minimum_lead_hours", field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name="serviceoffer", name="minimum_quantity", field=models.PositiveSmallIntegerField(default=1)),
        migrations.AddField(model_name="serviceoffer", name="preparation_notes", field=models.TextField(blank=True)),
        migrations.AddField(model_name="serviceoffer", name="pricing_model", field=models.CharField(choices=[("fixed", "مبلغ ثابت"), ("per_guest", "برای هر مهمان"), ("per_night", "برای هر شب"), ("per_unit", "برای هر واحد")], default="fixed", max_length=16)),
        migrations.AddField(model_name="serviceoffer", name="schedule_type", field=models.CharField(choices=[("none", "بدون انتخاب تاریخ"), ("stay_date", "یک روز از اقامت"), ("checkin", "روز ورود"), ("checkout", "روز خروج")], default="none", max_length=16)),
        migrations.AddField(model_name="serviceoffer", name="short_description", field=models.CharField(blank=True, max_length=220)),
        migrations.AddField(model_name="serviceoffer", name="sort_order", field=models.PositiveSmallIntegerField(default=0)),
        migrations.AddField(model_name="serviceoffer", name="unit_label", field=models.CharField(default="خدمت", max_length=40)),
        migrations.CreateModel(
            name="ServiceImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="services/gallery/%Y/%m/")),
                ("alt_text", models.CharField(blank=True, max_length=180)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="images", to="marketplace.serviceoffer")),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="ServiceAvailability",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(db_index=True)),
                ("status", models.CharField(choices=[("available", "قابل رزرو"), ("blocked", "مسدود"), ("closed", "تعطیل")], default="available", max_length=12)),
                ("capacity_override", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("price_override", models.DecimalField(blank=True, decimal_places=0, max_digits=14, null=True)),
                ("admin_note", models.CharField(blank=True, max_length=300)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="availability", to="marketplace.serviceoffer")),
            ],
            options={"ordering": ["date"], "constraints": [models.UniqueConstraint(fields=("service", "date"), name="unique_service_availability_date")]},
        ),
    ]
