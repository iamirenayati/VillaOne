from datetime import date, timedelta
from io import BytesIO
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.villas.models import Availability, City, Villa
from apps.marketplace.models import BusinessSettings, ServiceAvailability, ServiceOffer
from .models import AdminAuditLog, Booking, BookingService, CancellationRequest, Payment, Review
from .services import cancellation_quote, complete_booking, create_booking, decide_booking, mark_cancellation_refunded, reconcile_manual_payment, resolve_cancellation, review_card_transfer, submit_card_transfer

class BookingServiceTests(APITestCase):
    def setUp(self):
        self.localdate_patcher = patch("apps.bookings.services.timezone.localdate", return_value=date(2026, 8, 1))
        self.localdate_patcher.start()
        self.addCleanup(self.localdate_patcher.stop)
        cache.clear()
        self.owner = User.objects.create_user(username="owner", phone="09120000001")
        self.guest = User.objects.create_user(username="guest", phone="09120000002", is_phone_verified=True)
        self.admin = User.objects.create_user(username="admin", phone="09120000003", is_staff=True)
        self.finance_admin = User.objects.create_user(username="finance", phone="09120000004", role=User.Role.FINANCE_ADMIN)
        city = City.objects.create(name="سوادکوه")
        self.villa = Villa.objects.create(
            owner=self.owner,
            city=city,
            slug="khane-meh",
            title="خانه‌ی مه",
            description="اقامتگاه جنگلی",
            capacity=8,
            price_weekday=10_000_000,
            price_weekend=12_000_000,
            price_holiday=15_000_000,
            status=Villa.Status.PUBLISHED,
        )

    def test_overlapping_active_booking_is_rejected(self):
        create_booking(
            guest=self.guest,
            villa=self.villa,
            checkin=date(2026, 8, 10),
            checkout=date(2026, 8, 13),
            guests_count=2,
            payment_type="deposit",
        )
        with self.assertRaises(ValidationError):
            create_booking(
                guest=self.guest,
                villa=self.villa,
                checkin=date(2026, 8, 12),
                checkout=date(2026, 8, 14),
                guests_count=2,
                payment_type="deposit",
            )

    def test_admin_approval_locks_calendar_and_audits(self):
        booking = create_booking(
            guest=self.guest,
            villa=self.villa,
            checkin=date(2026, 8, 10),
            checkout=date(2026, 8, 13),
            guests_count=2,
            payment_type="deposit",
        )
        approved = decide_booking(booking=booking, admin_user=self.admin, approve=True)
        self.assertEqual(approved.status, Booking.Status.CONFIRMED)
        self.assertEqual(Availability.objects.filter(villa=self.villa, status=Availability.Status.BOOKED).count(), 3)
        self.assertTrue(AdminAuditLog.objects.filter(action="booking.confirmed", target_id=str(booking.pk)).exists())

    def test_authenticated_booking_api(self):
        self.client.force_authenticate(self.guest)
        response = self.client.post(reverse("booking-create"), {
            "villa_slug": self.villa.slug,
            "checkin": "2026-08-20",
            "checkout": "2026-08-23",
            "guests_count": 2,
            "payment_type": "deposit",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Booking.Status.PENDING_OWNER)
        self.assertEqual(response.data["payment_plan"], Booking.PaymentPlan.DEPOSIT)
        self.assertGreater(int(response.data["amount_due_now"]), 0)

    def test_public_quote_matches_created_booking(self):
        payload = {
            "villa_slug": self.villa.slug,
            "checkin": "2026-08-20",
            "checkout": "2026-08-23",
            "guests_count": 2,
            "payment_type": "deposit",
        }
        quote = self.client.post(reverse("booking-quote"), payload, format="json")
        self.client.force_authenticate(self.guest)
        booking = self.client.post(reverse("booking-create"), payload, format="json")

        self.assertEqual(quote.status_code, status.HTTP_200_OK)
        self.assertEqual(booking.status_code, status.HTTP_201_CREATED)
        self.assertEqual(quote.data["total_price"], booking.data["total_price"])
        self.assertEqual(quote.data["amount_due_now"], booking.data["amount_due_now"])

    def test_service_quote_uses_backend_pricing_model_and_returns_schedule(self):
        chef = ServiceOffer.objects.create(
            slug="private-chef",
            title="آشپز خصوصی",
            category="پذیرایی",
            description="تهیه وعده در ویلا",
            price_note="برای هر مهمان",
            base_price=1_200_000,
            fulfillment_mode="bookable",
            pricing_model="per_guest",
            unit_label="مهمان",
            minimum_lead_hours=24,
            schedule_type="stay_date",
            default_daily_capacity=2,
            status=ServiceOffer.Status.PUBLISHED,
        )
        payload = {
            "villa_slug": self.villa.slug,
            "checkin": "2026-08-20",
            "checkout": "2026-08-23",
            "guests_count": 3,
            "payment_type": "deposit",
            "service_items": [{"slug": chef.slug, "service_date": "2026-08-21", "time_slot": "dinner"}],
        }

        quote = self.client.post(reverse("booking-quote"), payload, format="json")

        self.assertEqual(quote.status_code, status.HTTP_200_OK, quote.data)
        self.assertEqual(quote.data["services_total"], "3600000")
        self.assertEqual(quote.data["services"][0]["quantity"], 3)
        self.assertEqual(quote.data["services"][0]["service_date"], "2026-08-21")
        self.assertEqual(quote.data["services"][0]["time_slot"], "dinner")

    def test_booking_snapshots_rich_service_selection(self):
        chef = ServiceOffer.objects.create(
            slug="private-chef-snapshot",
            title="آشپز خصوصی",
            category="پذیرایی",
            description="تهیه وعده در ویلا",
            price_note="برای هر مهمان",
            base_price=900_000,
            fulfillment_mode="bookable",
            pricing_model="per_guest",
            unit_label="مهمان",
            schedule_type="stay_date",
            default_daily_capacity=2,
            status=ServiceOffer.Status.PUBLISHED,
        )
        self.client.force_authenticate(self.guest)

        response = self.client.post(reverse("booking-create"), {
            "villa_slug": self.villa.slug,
            "checkin": "2026-08-20",
            "checkout": "2026-08-23",
            "guests_count": 2,
            "payment_type": "deposit",
            "service_items": [{"slug": chef.slug, "service_date": "2026-08-21", "time_slot": "lunch", "note": "غذای بدون گردو"}],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        line = response.data["service_items"][0]
        self.assertEqual(line["quantity"], 2)
        self.assertEqual(line["pricing_model"], "per_guest")
        self.assertEqual(line["unit_label"], "مهمان")
        self.assertEqual(line["service_date"], "2026-08-21")
        self.assertEqual(line["time_slot"], "lunch")
        self.assertEqual(line["customer_note"], "غذای بدون گردو")

    def test_service_capacity_and_blocked_dates_are_enforced_at_api_boundary(self):
        chef = ServiceOffer.objects.create(
            slug="private-chef-blocked",
            title="آشپز خصوصی",
            category="پذیرایی",
            description="تهیه وعده در ویلا",
            price_note="مبلغ ثابت",
            base_price=3_000_000,
            fulfillment_mode="bookable",
            schedule_type="stay_date",
            default_daily_capacity=1,
            status=ServiceOffer.Status.PUBLISHED,
        )
        ServiceAvailability.objects.create(service=chef, date=date(2026, 8, 21), status=ServiceAvailability.Status.BLOCKED)

        blocked = self.client.post(reverse("booking-quote"), {
            "villa_slug": self.villa.slug,
            "checkin": "2026-08-20",
            "checkout": "2026-08-23",
            "guests_count": 2,
            "payment_type": "deposit",
            "service_items": [{"slug": chef.slug, "service_date": "2026-08-21"}],
        }, format="json")

        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("در دسترس نیست", str(blocked.data))

    def test_content_admin_can_operate_service_fulfilment_queue(self):
        chef = ServiceOffer.objects.create(slug="ops-chef", title="آشپز خصوصی", category="پذیرایی", description="تست", price_note="ثابت", base_price=2_000_000, fulfillment_mode="bookable", schedule_type="stay_date", status="published")
        booking = create_booking(guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23), guests_count=2, payment_type="deposit", service_items=[{"slug": chef.slug, "service_date": date(2026, 8, 21), "time_slot": "dinner", "note": "بدون گردو"}])
        line = booking.service_items.get()
        admin = User.objects.create_user(username="service-ops", phone="09120000034", role=User.Role.CONTENT_ADMIN)
        self.client.force_authenticate(admin)

        queue = self.client.get(reverse("admin-service-items"), {"status": "requested"})
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertEqual(queue.data[0]["booking_code"], booking.code)
        confirmed = self.client.patch(reverse("admin-service-item-detail", kwargs={"pk": line.pk}), {"status": "confirmed", "admin_note": "هماهنگ شد"}, format="json")
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)
        self.assertEqual(confirmed.data["status"], BookingService.Status.CONFIRMED)
        self.assertTrue(AdminAuditLog.objects.filter(action="booking_service.confirmed", target_id=str(line.pk)).exists())

    def test_quote_rejects_one_night_and_past_stays(self):
        one_night = self.client.post(reverse("booking-quote"), {"villa_slug": self.villa.slug, "checkin": "2026-08-20", "checkout": "2026-08-21", "guests_count": 2, "payment_type": "deposit"}, format="json")
        self.assertEqual(one_night.status_code, status.HTTP_409_CONFLICT)
        past = self.client.post(reverse("booking-quote"), {"villa_slug": self.villa.slug, "checkin": "2020-08-20", "checkout": "2020-08-23", "guests_count": 2, "payment_type": "deposit"}, format="json")
        self.assertEqual(past.status_code, status.HTTP_409_CONFLICT)

    @override_settings(PAYMENT_MOCK_ENABLED=True)
    def test_local_payment_flow_updates_financial_state(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        self.client.force_authenticate(self.guest)
        initiated = self.client.post(reverse("payment-initiate", kwargs={"code": booking.code}), {}, format="json")
        self.assertEqual(initiated.status_code, status.HTTP_201_CREATED, initiated.data)
        authority = initiated.data["payment"]["authority"]
        completed = self.client.post(reverse("mock-payment-complete", kwargs={"authority": authority}), {"result": "paid"}, format="json")

        booking.refresh_from_db()
        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        self.assertEqual(completed.data["payment"]["status"], Payment.Status.PAID)
        self.assertEqual(booking.deposit_paid_online, booking.amount_due_now)
        self.assertEqual(booking.remaining_amount, booking.total_price - booking.amount_due_now)

    def test_mock_payment_is_disabled_by_default(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        self.client.force_authenticate(self.guest)
        response = self.client.post(reverse("payment-initiate", kwargs={"code": booking.code}), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_authorized_staff_can_read_paginated_audit_log(self):
        admin = User.objects.create_user(username="audit-admin", phone="09120000019", role=User.Role.SUPER_ADMIN)
        AdminAuditLog.objects.create(admin=admin, action="villa.updated", target_type="Villa", target_id=str(self.villa.pk))
        self.client.force_authenticate(admin)
        response = self.client.get(reverse("admin-audit-log"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["actor"]["phone"], admin.phone)

        self.client.force_authenticate(self.guest)
        self.assertEqual(self.client.get(reverse("admin-audit-log")).status_code, status.HTTP_403_FORBIDDEN)

    def test_guest_can_create_and_list_own_support_ticket(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        self.client.force_authenticate(self.guest)
        response = self.client.post(reverse("support-tickets"), {
            "booking_code": booking.code,
            "category": "booking",
            "subject": "پرسش درباره زمان ورود",
            "message": "آیا امکان ورود یک ساعت زودتر وجود دارد؟",
        }, format="json")
        tickets = self.client.get(reverse("support-tickets"))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(tickets.status_code, status.HTTP_200_OK)
        self.assertEqual(tickets.data[0]["booking"], booking.code)

    def test_guest_can_request_cancellation_once(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        self.client.force_authenticate(self.guest)
        url = reverse("booking-cancellation", kwargs={"code": booking.code})
        response = self.client.post(url, {"reason": "برنامه سفر من تغییر کرده است."}, format="json")
        duplicate = self.client.post(url, {"reason": "درخواست دوباره برای لغو رزرو"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], CancellationRequest.Status.REQUESTED)
        self.assertEqual(response.data["refund_percentage"], 90)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancellation_quote_uses_policy_and_paid_amount(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        booking.deposit_paid_online = 3_000_000
        booking.cancellation_policy_applied = {
            "more_than_7_days": 90, "between_3_and_7_days": 50, "less_than_3_days": 0,
        }
        booking.save(update_fields=["deposit_paid_online", "cancellation_policy_applied"])

        early = cancellation_quote(booking, today=date(2026, 8, 10))
        middle = cancellation_quote(booking, today=date(2026, 8, 15))
        late = cancellation_quote(booking, today=date(2026, 8, 19))

        self.assertEqual(early["estimated_refund_amount"], 2_700_000)
        self.assertEqual(middle["estimated_refund_amount"], 1_500_000)
        self.assertEqual(late["estimated_refund_amount"], 0)

    def test_approved_cancellation_cancels_booking_and_releases_calendar(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        booking = decide_booking(booking=booking, admin_user=self.admin, approve=True)
        cancellation = CancellationRequest.objects.create(booking=booking, reason="برنامه سفر تغییر کرده است.")

        resolved = resolve_cancellation(cancellation_request=cancellation, admin_user=self.admin, approve=True)
        booking.refresh_from_db()

        self.assertEqual(resolved.status, CancellationRequest.Status.APPROVED)
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertEqual(booking.refund_amount, cancellation.estimated_refund_amount)
        self.assertFalse(Availability.objects.filter(villa=self.villa, note=booking.code).exists())
        self.assertTrue(AdminAuditLog.objects.filter(action="cancellation.approved", target_id=str(cancellation.pk)).exists())

    def test_review_requires_completed_stay_and_is_unique(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        self.client.force_authenticate(self.guest)
        url = reverse("booking-review", kwargs={"code": booking.code})
        payload = {"rating": 5, "title": "اقامت عالی", "comment": "همه چیز تمیز و دقیقاً مطابق توضیحات بود."}

        blocked = self.client.post(url, payload, format="json")
        booking.status = Booking.Status.COMPLETED
        booking.save(update_fields=["status"])
        created = self.client.post(url, payload, format="json")
        duplicate = self.client.post(url, payload, format="json")

        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["status"], Review.Status.PENDING)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_approved_reviews_are_public_and_counted(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        review = Review.objects.create(
            booking=booking, villa=self.villa, guest=self.guest, rating=5,
            title="عالی", comment="اقامت بسیار خوب و آرامی داشتیم.",
        )
        reviews_url = reverse("villa-reviews", kwargs={"slug": self.villa.slug})
        detail_url = reverse("villa-detail", kwargs={"slug": self.villa.slug})

        self.assertEqual(len(self.client.get(reviews_url).data), 0)
        review.status = Review.Status.APPROVED
        review.save(update_fields=["status"])
        reviews = self.client.get(reviews_url)
        detail = self.client.get(detail_url)

        self.assertEqual(len(reviews.data), 1)
        self.assertEqual(detail.data["reviews_count"], 1)
        self.assertEqual(detail.data["rating_average"], "5.00")

    def test_manual_payment_reconciliation_updates_booking_and_audits(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        payment = Payment.objects.create(booking=booking, gateway=Payment.Gateway.MANUAL, amount=booking.amount_due_now)

        reconcile_manual_payment(payment=payment, admin_user=self.admin)
        booking.refresh_from_db()
        payment.refresh_from_db()

        self.assertEqual(payment.status, Payment.Status.PAID)
        self.assertTrue(payment.reference_id.startswith("MANUAL-"))
        self.assertEqual(booking.deposit_paid_online, booking.amount_due_now)
        self.assertTrue(AdminAuditLog.objects.filter(action="payment.manually_reconciled", target_id=str(payment.pk)).exists())

    def test_completed_stay_transition_is_guarded_and_audited(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        booking = decide_booking(booking=booking, admin_user=self.admin, approve=True)

        with self.assertRaises(ValidationError):
            complete_booking(booking=booking, admin_user=self.admin, today=date(2026, 8, 22))
        completed = complete_booking(booking=booking, admin_user=self.admin, today=date(2026, 8, 23))

        self.assertEqual(completed.status, Booking.Status.COMPLETED)
        self.assertTrue(AdminAuditLog.objects.filter(action="booking.completed", target_id=str(booking.pk)).exists())

    def test_refund_confirmation_requires_approved_cancellation(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        cancellation = CancellationRequest.objects.create(booking=booking, reason="تغییر برنامه سفر", estimated_refund_amount=100_000)
        with self.assertRaises(ValidationError):
            mark_cancellation_refunded(cancellation_request=cancellation, admin_user=self.admin)
        cancellation.status = CancellationRequest.Status.APPROVED
        cancellation.save(update_fields=["status"])

        refunded = mark_cancellation_refunded(cancellation_request=cancellation, admin_user=self.admin)

        self.assertEqual(refunded.status, CancellationRequest.Status.REFUNDED)
        self.assertTrue(AdminAuditLog.objects.filter(action="cancellation.refunded", target_id=str(cancellation.pk)).exists())

    def test_unpaid_hold_expires_and_releases_dates(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        booking.expires_at = timezone.now() - timedelta(minutes=1)
        booking.save(update_fields=["expires_at"])

        quote = self.client.post(reverse("booking-quote"), {
            "villa_slug": self.villa.slug, "checkin": "2026-08-20", "checkout": "2026-08-23",
            "guests_count": 2, "payment_type": "deposit",
        }, format="json")
        booking.refresh_from_db()

        self.assertEqual(quote.status_code, status.HTTP_200_OK)
        self.assertEqual(booking.status, Booking.Status.EXPIRED)

    @override_settings(PAYMENT_MOCK_ENABLED=True)
    def test_expired_request_cannot_be_paid(self):
        booking = create_booking(
            guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23),
            guests_count=2, payment_type="deposit",
        )
        booking.expires_at = timezone.now() - timedelta(minutes=1)
        booking.save(update_fields=["expires_at"])
        self.client.force_authenticate(self.guest)

        response = self.client.post(reverse("payment-initiate", kwargs={"code": booking.code}), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_card_transfer_approval_confirms_booking(self):
        BusinessSettings.objects.create(card_transfer_enabled=True, card_transfer_bank_name="Bank", card_transfer_cardholder_name="VillaOne", card_transfer_card_number="1234567812345678")
        booking = create_booking(guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23), guests_count=2, payment_type="deposit")
        from PIL import Image
        stream = BytesIO(); Image.new("RGB", (400, 400), "white").save(stream, format="PNG")
        image = SimpleUploadedFile("receipt.png", stream.getvalue(), content_type="image/png")
        payment = submit_card_transfer(booking=booking, proof_image=image, reference_id="TRACK-1")
        payment = review_card_transfer(payment=payment, admin_user=self.admin, approve=True)
        booking.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(Availability.objects.filter(villa=self.villa, note=booking.code).count(), 3)

    def test_finance_queue_is_paginated_searchable_and_private(self):
        booking = create_booking(guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23), guests_count=2, payment_type="deposit")
        payment = Payment.objects.create(booking=booking, gateway=Payment.Gateway.CARD_TO_CARD, amount=booking.amount_due_now, reference_id="TRACE-77")
        url = reverse("admin-card-transfer-payments")

        self.client.force_authenticate(self.guest)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.finance_admin)
        response = self.client.get(url, {"status": "pending", "q": "TRACE-77", "page": 1})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["id"], payment.pk)
        self.assertEqual(row["booking_code"], booking.code)
        self.assertEqual(row["customer"]["phone"], self.guest.phone)
        self.assertNotIn("proof_image", row)
        self.assertEqual(self.client.get(url, {"status": "unknown"}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_finance_rejection_requires_reason_and_audits_it(self):
        booking = create_booking(guest=self.guest, villa=self.villa, checkin=date(2026, 8, 20), checkout=date(2026, 8, 23), guests_count=2, payment_type="deposit")
        payment = Payment.objects.create(booking=booking, gateway=Payment.Gateway.CARD_TO_CARD, amount=booking.amount_due_now)
        self.client.force_authenticate(self.finance_admin)
        url = reverse("admin-card-transfer-review", kwargs={"pk": payment.pk})

        self.assertEqual(self.client.post(url, {"action": "reject"}, format="json").status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(url, {"action": "reject", "review_note": "مبلغ رسید قابل تطبیق نیست."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        audit = AdminAuditLog.objects.get(action="payment.card_transfer_rejected", target_id=str(payment.pk))
        self.assertEqual(audit.metadata["reason"], "مبلغ رسید قابل تطبیق نیست.")
