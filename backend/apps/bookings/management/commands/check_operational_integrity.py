import json
import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.bookings.models import OperationalTaskRun
from apps.bookings.operations import check_operational_integrity


class Command(BaseCommand):
    help = "Runs read-only checks for booking, payment, calendar, media, and launch consistency."

    def handle(self, *args, **options):
        started = timezone.now()
        clock = time.monotonic()
        issues = check_operational_integrity()
        run, _ = OperationalTaskRun.objects.update_or_create(
            task_name="check_operational_integrity",
            defaults={
                "status": OperationalTaskRun.Status.FAILED if issues else OperationalTaskRun.Status.SUCCEEDED,
                "started_at": started,
                "finished_at": timezone.now(),
                "duration_ms": int((time.monotonic() - clock) * 1000),
                "processed_count": len(issues),
                "error_summary": f"{len(issues)} integrity issue(s) found." if issues else "",
                "details": {"issues": issues[:100]},
            },
        )
        if issues:
            raise CommandError(json.dumps(issues, ensure_ascii=False, indent=2))
        self.stdout.write(self.style.SUCCESS("Operational integrity checks passed."))
