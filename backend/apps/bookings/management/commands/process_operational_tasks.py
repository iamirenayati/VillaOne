import logging
import time

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.bookings.models import OperationalTaskRun
from apps.bookings.services import expire_stale_bookings


logger = logging.getLogger("villaone.operations")


class Command(BaseCommand):
    help = "Processes bounded, idempotent VillaOne housekeeping tasks."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=100)

    def handle(self, *args, **options):
        started = timezone.now()
        clock = time.monotonic()
        run, _ = OperationalTaskRun.objects.update_or_create(
            task_name="process_operational_tasks",
            defaults={"status": OperationalTaskRun.Status.RUNNING, "started_at": started, "finished_at": None, "error_summary": ""},
        )
        try:
            processed = expire_stale_bookings(batch_size=max(1, min(options["batch_size"], 1000)))
        except Exception as exc:
            run.status = OperationalTaskRun.Status.FAILED
            run.finished_at = timezone.now()
            run.duration_ms = int((time.monotonic() - clock) * 1000)
            run.error_summary = f"{type(exc).__name__}: {str(exc)[:400]}"
            run.save(update_fields=["status", "finished_at", "duration_ms", "error_summary", "updated_at"])
            logger.exception("operational task failed", extra={"event": "operational_task_failed", "task_name": run.task_name})
            raise
        run.status = OperationalTaskRun.Status.SUCCEEDED
        run.finished_at = timezone.now()
        run.duration_ms = int((time.monotonic() - clock) * 1000)
        run.processed_count = processed
        run.details = {"expired_bookings": processed}
        run.save(update_fields=["status", "finished_at", "duration_ms", "processed_count", "details", "updated_at"])
        logger.info("operational task completed", extra={"event": "operational_task_completed", "task_name": run.task_name, "processed_count": processed})
        self.stdout.write(self.style.SUCCESS(f"Processed {processed} expired booking holds."))
