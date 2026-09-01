import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings as django_settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from datetime import timedelta

from django.utils import timezone

from apps.marketplace.models import Article, BusinessSettings, Contractor, RealEstateListing, ServiceOffer
from apps.villas.models import Villa
from apps.bookings.models import OperationalTaskRun


REQUIRED_BUSINESS_FIELDS = (
    ("support_phone", "شماره پشتیبانی"),
    ("operating_hours", "ساعات پاسخ‌گویی"),
    ("footer_description", "توضیح فوتر"),
    ("terms_text", "شرایط استفاده"),
    ("privacy_text", "حریم خصوصی"),
    ("cancellation_text", "سیاست لغو"),
)


class Command(BaseCommand):
    help = "Checks that public content and business contact details are ready for a real release."

    def add_arguments(self, parser):
        parser.add_argument("--production", action="store_true")

    def handle(self, *args, **options):
        failures = []
        settings = BusinessSettings.objects.filter(pk=1).first()
        if not settings:
            missing = ", ".join(f"{field} ({label})" for field, label in REQUIRED_BUSINESS_FIELDS)
            failures.append("Business settings record is missing; create it in Django Admin. Required fields: " + missing)
        else:
            missing = [f"{field} ({label})" for field, label in REQUIRED_BUSINESS_FIELDS if not str(getattr(settings, field, "") or "").strip()]
            if missing:
                failures.append("Business settings missing: " + ", ".join(missing))
        if not Villa.objects.filter(status=Villa.Status.PUBLISHED).exists():
            failures.append("هیچ ویلای منتشرشده‌ای وجود ندارد.")
        required_catalogs = (
            (Contractor, "پیمانکار"),
            (RealEstateListing, "ملک"),
            (ServiceOffer, "خدمت"),
            (Article, "مقاله"),
        )
        for model, label in required_catalogs:
            if not model.objects.filter(status=model.Status.PUBLISHED).exists():
                failures.append(f"هیچ {label} منتشرشده‌ای وجود ندارد.")
        if options["production"]:
            if django_settings.DEBUG:
                failures.append("DEBUG must be disabled for a production release.")
            if connection.vendor != "postgresql":
                failures.append("Production release verification requires PostgreSQL.")
            if not os.getenv("FRONTEND_URL", "").strip():
                failures.append("FRONTEND_URL must be configured for production redirects.")
            if not django_settings.ALLOWED_HOSTS:
                failures.append("DJANGO_ALLOWED_HOSTS must contain at least one host.")
            if not django_settings.CORS_ALLOWED_ORIGINS:
                failures.append("CORS_ALLOWED_ORIGINS must contain the frontend origin.")
            if not django_settings.CSRF_TRUSTED_ORIGINS:
                failures.append("CSRF_TRUSTED_ORIGINS must contain the frontend origin.")
            for storage_name in ("MEDIA_ROOT", "PRIVATE_MEDIA_ROOT"):
                storage_path = Path(getattr(django_settings, storage_name))
                if not storage_path.exists() or not os.access(storage_path, os.W_OK):
                    failures.append(f"{storage_name} is not writable: {storage_path}")
            if django_settings.PAYMENT_MOCK_ENABLED or django_settings.OTP_DEBUG_CODE:
                failures.append("Mock payment and OTP debug output must be disabled.")
            executor = MigrationExecutor(connection)
            pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
            if pending:
                failures.append(f"{len(pending)} database migration(s) are pending.")
            if not settings or not (
                settings.card_transfer_enabled
                and settings.card_transfer_bank_name
                and settings.card_transfer_cardholder_name
                and settings.card_transfer_card_number
            ):
                failures.append("Card-to-card payment configuration is incomplete.")
            housekeeping = OperationalTaskRun.objects.filter(task_name="process_operational_tasks").first()
            if not housekeeping or housekeeping.status != OperationalTaskRun.Status.SUCCEEDED or not housekeeping.finished_at or housekeeping.finished_at < timezone.now() - timedelta(minutes=3):
                failures.append("Operational housekeeping has not completed successfully in the last three minutes.")
        if failures:
            raise CommandError("\n".join(failures))
        self.stdout.write(self.style.SUCCESS("Release content checks passed."))
