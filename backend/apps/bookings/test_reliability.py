from datetime import timedelta
import json

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.villas.models import City, Villa

from .models import AdminAuditLog, Booking, CustomerNotification, OperationalTaskRun, Payment
from .services import create_booking, decide_booking, expire_stale_bookings


class ReliableBookingWorkflowTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="reliability-owner", phone="09120000071")
        self.guest = User.objects.create_user(username="reliability-guest", phone="09120000072")
        self.villa = Villa.objects.create(
            owner=self.owner,
            city=City.objects.create(name="Reliability City"),
            slug="reliability-villa",
            title="Reliability Villa",
            description="A real test villa",
            capacity=6,
            price_weekday=10_000_000,
            price_weekend=12_000_000,
            price_holiday=15_000_000,
            status=Villa.Status.PUBLISHED,
        )
        self.checkin = timezone.localdate() + timedelta(days=30)
        self.checkout = self.checkin + timedelta(days=3)

    def booking(self, **overrides):
        values = {
            "guest": self.guest,
            "villa": self.villa,
            "checkin": self.checkin,
            "checkout": self.checkout,
            "guests_count": 2,
            "payment_type": "deposit",
            "client_request_id": "booking-request-001",
        }
        values.update(overrides)
        return create_booking(**values)

    def test_booking_creation_is_idempotent_for_the_same_request(self):
        original = self.booking()
        replay = self.booking()

        self.assertEqual(replay.pk, original.pk)
        self.assertEqual(Booking.objects.count(), 1)

    def test_booking_idempotency_key_rejects_changed_payload(self):
        self.booking()

        with self.assertRaises(ValidationError):
            self.booking(guests_count=3)

    def test_expiry_closes_payment_audits_and_notifies_once(self):
        booking = self.booking(client_request_id="expiry-request")
        booking.expires_at = timezone.now() - timedelta(minutes=1)
        booking.save(update_fields=["expires_at"])
        payment = Payment.objects.create(
            booking=booking,
            gateway=Payment.Gateway.CARD_TO_CARD,
            amount=booking.amount_due_now,
            status=Payment.Status.PENDING,
        )

        self.assertEqual(expire_stale_bookings(batch_size=10), 1)
        self.assertEqual(expire_stale_bookings(batch_size=10), 0)

        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.EXPIRED)
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertEqual(CustomerNotification.objects.filter(user=self.guest, kind="booking_expired").count(), 1)
        audit = AdminAuditLog.objects.get(action="booking.expired", target_id=str(booking.pk))
        self.assertIsNone(audit.admin)
        self.assertEqual(audit.system_actor, "operational_tasks")
        payment_audit = AdminAuditLog.objects.get(action="payment.expired", target_id=str(payment.pk))
        self.assertEqual(payment_audit.system_actor, "operational_tasks")

    def test_operational_command_persists_success_and_is_idempotent(self):
        booking = self.booking(client_request_id="command-expiry-request")
        booking.expires_at = timezone.now() - timedelta(minutes=1)
        booking.save(update_fields=["expires_at"])

        call_command("process_operational_tasks", batch_size=10)
        call_command("process_operational_tasks", batch_size=10)

        booking.refresh_from_db()
        run = OperationalTaskRun.objects.get(task_name="process_operational_tasks")
        self.assertEqual(booking.status, Booking.Status.EXPIRED)
        self.assertEqual(run.status, OperationalTaskRun.Status.SUCCEEDED)
        self.assertEqual(run.processed_count, 0)

    def test_customer_notification_api_is_owner_scoped_and_markable(self):
        booking = self.booking(client_request_id="notification-request")
        notification = CustomerNotification.objects.get(booking=booking, kind="booking_created")
        self.client.force_authenticate(self.guest)

        listed = self.client.get(reverse("customer-notifications"))
        marked = self.client.post(reverse("customer-notification-read", kwargs={"pk": notification.pk}))

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data[0]["booking_code"], booking.code)
        self.assertEqual(marked.status_code, 200)
        self.assertIsNotNone(marked.data["read_at"])

    def test_health_routes_separate_liveness_and_readiness(self):
        live = self.client.get(reverse("health-live"))
        ready = self.client.get(reverse("health-ready"))

        self.assertEqual(live.status_code, 200)
        self.assertEqual(json.loads(live.content), {"status": "ok"})
        self.assertEqual(ready.status_code, 200)
        self.assertEqual(json.loads(ready.content)["pending_migrations"], 0)

    def test_api_errors_include_request_id_without_breaking_detail(self):
        self.client.force_authenticate(self.guest)
        response = self.client.post(
            reverse("booking-create"),
            {"villa_slug": "missing", "checkin": self.checkin, "checkout": self.checkout, "guests_count": 2},
            format="json",
            HTTP_X_REQUEST_ID="reliability-request-id",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("villa_slug", response.data)
        self.assertEqual(response.data["request_id"], "reliability-request-id")
        self.assertEqual(response["X-Request-ID"], "reliability-request-id")

    def test_repeating_booking_decision_is_idempotent(self):
        admin = User.objects.create_superuser(username="reliability-admin", phone="09120000073")
        booking = self.booking(client_request_id="decision-request")

        first = decide_booking(booking=booking, admin_user=admin, approve=True)
        replay = decide_booking(booking=booking, admin_user=admin, approve=True)

        self.assertEqual(first.pk, replay.pk)
        self.assertEqual(AdminAuditLog.objects.filter(action="booking.confirmed", target_id=str(booking.pk)).count(), 1)

    def test_system_audit_actor_is_serializable(self):
        audit = AdminAuditLog.objects.create(
            system_actor="operational_tasks",
            action="integrity.checked",
            target_type="system",
            target_id="operations",
        )
        admin = User.objects.create_superuser(username="audit-admin", phone="09120000074")
        self.client.force_authenticate(admin)

        response = self.client.get(reverse("admin-audit-log"))

        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data["results"] if item["id"] == audit.pk)
        self.assertEqual(row["actor"]["role"], "system")
