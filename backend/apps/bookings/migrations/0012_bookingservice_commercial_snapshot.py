from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0011_alter_payment_proof_image"),
        ("marketplace", "0010_serviceoffer_booking_catalog"),
    ]

    operations = [
        migrations.AddField(model_name="bookingservice", name="customer_note", field=models.CharField(blank=True, max_length=500)),
        migrations.AddField(model_name="bookingservice", name="pricing_model", field=models.CharField(default="fixed", max_length=16)),
        migrations.AddField(model_name="bookingservice", name="service_date", field=models.DateField(blank=True, db_index=True, null=True)),
        migrations.AddField(model_name="bookingservice", name="time_slot", field=models.CharField(blank=True, max_length=24)),
        migrations.AddField(model_name="bookingservice", name="unit_label", field=models.CharField(default="خدمت", max_length=40)),
        migrations.AlterField(model_name="bookingservice", name="status", field=models.CharField(choices=[("requested", "در انتظار هماهنگی"), ("confirmed", "تأیید شده"), ("unavailable", "ناموجود"), ("completed", "انجام شده"), ("cancelled", "لغو شده")], default="requested", max_length=16)),
    ]
