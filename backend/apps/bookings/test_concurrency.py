from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO
from unittest import skipUnless

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone
from PIL import Image

from apps.accounts.models import User
from apps.marketplace.models import BusinessSettings
from apps.villas.models import City, Villa

from .models import AdminAuditLog, Booking
from .services import create_booking, review_card_transfer, submit_card_transfer


@skipUnless(connection.vendor == "postgresql", "PostgreSQL row-lock semantics are tested in CI.")
class PostgreSQLBookingConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.owner = User.objects.create_user(username="concurrency-owner", phone="09120000101")
        self.guest_a = User.objects.create_user(username="concurrency-a", phone="09120000102")
        self.guest_b = User.objects.create_user(username="concurrency-b", phone="09120000103")
        self.admin = User.objects.create_superuser(username="concurrency-admin", phone="09120000104")
        self.villa = Villa.objects.create(
            owner=self.owner,
            city=City.objects.create(name="Concurrency City"),
            slug="concurrency-villa",
            title="Concurrency Villa",
            description="Concurrency test inventory",
            capacity=4,
            price_weekday=10_000_000,
            price_weekend=10_000_000,
            price_holiday=10_000_000,
            status=Villa.Status.PUBLISHED,
        )
        self.checkin = timezone.localdate() + timedelta(days=40)
        self.checkout = self.checkin + timedelta(days=3)

    def _book(self, guest_id, request_id):
        close_old_connections()
        try:
            return create_booking(
                guest=User.objects.get(pk=guest_id),
                villa=Villa.objects.get(pk=self.villa.pk),
                checkin=self.checkin,
                checkout=self.checkout,
                guests_count=2,
                payment_type="deposit",
                client_request_id=request_id,
            ).pk
        except ValidationError:
            return None
        finally:
            close_old_connections()

    def test_overlapping_requests_create_only_one_active_booking(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(
                lambda args: self._book(*args),
                [(self.guest_a.pk, "concurrent-a"), (self.guest_b.pk, "concurrent-b")],
            ))

        self.assertEqual(sum(result is not None for result in results), 1)
        self.assertEqual(Booking.objects.filter(villa=self.villa, status=Booking.Status.PENDING_OWNER).count(), 1)

    def test_simultaneous_payment_approval_is_applied_once(self):
        BusinessSettings.objects.create(
            card_transfer_enabled=True,
            card_transfer_bank_name="Bank",
            card_transfer_cardholder_name="VillaOne",
            card_transfer_card_number="1234567812345678",
        )
        booking = create_booking(
            guest=self.guest_a, villa=self.villa, checkin=self.checkin, checkout=self.checkout,
            guests_count=2, payment_type="deposit", client_request_id="approval-booking",
        )
        image_bytes = BytesIO()
        Image.new("RGB", (400, 400), "white").save(image_bytes, format="PNG")
        payment = submit_card_transfer(
            booking=booking,
            proof_image=SimpleUploadedFile("receipt.png", image_bytes.getvalue(), content_type="image/png"),
            reference_id="CONCURRENT-REF",
            client_request_id="approval-receipt",
        )

        def approve(_):
            close_old_connections()
            try:
                review_card_transfer(
                    payment=payment.__class__.objects.get(pk=payment.pk),
                    admin_user=User.objects.get(pk=self.admin.pk),
                    approve=True,
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(approve, range(2)))

        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(AdminAuditLog.objects.filter(action="payment.card_transfer_approved", target_id=str(payment.pk)).count(), 1)
