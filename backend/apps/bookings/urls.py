from django.urls import path
from django.conf import settings

from .views import AdminAuditLogListView, AdminBookingActionView, AdminBookingListView, AdminBookingServiceDetailView, AdminBookingServiceListView, AdminCancellationActionView, AdminCancellationListView, AdminCardTransferPaymentListView, AdminCardTransferProofView, AdminCardTransferReviewView, AdminManualPaymentRecordView, AdminOperationsOverviewView, AdminPaymentReconcileView, AdminSupportTicketListView, AdminSupportTicketUpdateView, AdminSystemStatusView, BookingCreateView, BookingQuoteView, BookingReviewCreateView, CardTransferInstructionsView, CardTransferProofView, CardTransferSubmitView, CancellationRequestCreateView, CustomerNotificationListView, CustomerNotificationReadView, MockPaymentCompleteView, MyBookingDetailView, MyBookingListView, PaymentInitiateView, SupportTicketListCreateView

urlpatterns = [
    path("", BookingCreateView.as_view(), name="booking-create"),
    path("quote/", BookingQuoteView.as_view(), name="booking-quote"),
    path("mine/", MyBookingListView.as_view(), name="my-bookings"),
    path("mine/<str:code>/", MyBookingDetailView.as_view(), name="my-booking-detail"),
    path("mine/<str:code>/cancellation/", CancellationRequestCreateView.as_view(), name="booking-cancellation"),
    path("mine/<str:code>/review/", BookingReviewCreateView.as_view(), name="booking-review"),
    path("mine/<str:code>/payment-instructions/", CardTransferInstructionsView.as_view(), name="card-transfer-instructions"),
    path("mine/<str:code>/card-transfer/", CardTransferSubmitView.as_view(), name="card-transfer-submit"),
    path("mine/<str:code>/payments/<int:pk>/proof/", CardTransferProofView.as_view(), name="card-transfer-proof"),
    path("support/", SupportTicketListCreateView.as_view(), name="support-tickets"),
    path("notifications/", CustomerNotificationListView.as_view(), name="customer-notifications"),
    path("notifications/<int:pk>/read/", CustomerNotificationReadView.as_view(), name="customer-notification-read"),
    path("admin/", AdminBookingListView.as_view(), name="admin-bookings"),
    path("admin/overview/", AdminOperationsOverviewView.as_view(), name="admin-operations-overview"),
    path("admin/system-status/", AdminSystemStatusView.as_view(), name="admin-system-status"),
    path("admin/service-items/", AdminBookingServiceListView.as_view(), name="admin-service-items"),
    path("admin/service-items/<int:pk>/", AdminBookingServiceDetailView.as_view(), name="admin-service-item-detail"),
    path("admin/audit/", AdminAuditLogListView.as_view(), name="admin-audit-log"),
    path("admin/<str:code>/decision/", AdminBookingActionView.as_view(), name="admin-booking-decision"),
    path("admin/<str:code>/manual-payment/", AdminManualPaymentRecordView.as_view(), name="admin-manual-payment-record"),
    path("admin/payments/<int:pk>/reconcile/", AdminPaymentReconcileView.as_view(), name="admin-payment-reconcile"),
    path("admin/payments/", AdminCardTransferPaymentListView.as_view(), name="admin-card-transfer-payments"),
    path("admin/payments/<int:pk>/review/", AdminCardTransferReviewView.as_view(), name="admin-card-transfer-review"),
    path("admin/payments/<int:pk>/proof/", AdminCardTransferProofView.as_view(), name="admin-card-transfer-proof"),
    path("admin/cancellations/", AdminCancellationListView.as_view(), name="admin-cancellations"),
    path("admin/cancellations/<int:pk>/", AdminCancellationActionView.as_view(), name="admin-cancellation-action"),
    path("admin/support/", AdminSupportTicketListView.as_view(), name="admin-support-tickets"),
    path("admin/support/<int:pk>/", AdminSupportTicketUpdateView.as_view(), name="admin-support-ticket-update"),
]

if settings.PAYMENT_MOCK_ENABLED or "test" in __import__("sys").argv:
    urlpatterns += [
        path("mine/<str:code>/payments/", PaymentInitiateView.as_view(), name="payment-initiate"),
        path("payments/<str:authority>/mock-complete/", MockPaymentCompleteView.as_view(), name="mock-payment-complete"),
    ]
