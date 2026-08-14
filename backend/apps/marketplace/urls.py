from django.urls import path

from .views import AdminContractorListView, AdminContractorUpdateView, AdminInquiryListView, AdminInquiryUpdateView, AdminServiceAvailabilityView, AdminServiceDetailView, AdminServiceListCreateView, ArticleDetailView, ArticleListView, BusinessSettingsView, ContractorDetailView, ContractorListView, EligibleServiceListView, InquiryCreateView, RealEstateDetailView, RealEstateListView, ServiceDetailView, ServiceListView

urlpatterns = [
    path("site/", BusinessSettingsView.as_view(), name="business-settings"),
    path("real-estate/", RealEstateListView.as_view(), name="real-estate-list"),
    path("real-estate/<slug:slug>/", RealEstateDetailView.as_view(), name="real-estate-detail"),
    path("contractors/", ContractorListView.as_view(), name="contractor-list"),
    path("contractors/<slug:slug>/", ContractorDetailView.as_view(), name="contractor-detail"),
    path("articles/", ArticleListView.as_view(), name="article-list"),
    path("articles/<slug:slug>/", ArticleDetailView.as_view(), name="article-detail"),
    path("services/", ServiceListView.as_view(), name="service-list"),
    path("services/eligible/", EligibleServiceListView.as_view(), name="service-eligible"),
    path("services/<slug:slug>/", ServiceDetailView.as_view(), name="service-detail"),
    path("inquiries/", InquiryCreateView.as_view(), name="inquiry-create"),
    path("admin/contractors/", AdminContractorListView.as_view(), name="admin-contractor-list"),
    path("admin/contractors/<slug:slug>/", AdminContractorUpdateView.as_view(), name="admin-contractor-update"),
    path("admin/services/", AdminServiceListCreateView.as_view(), name="admin-service-list"),
    path("admin/services/<slug:slug>/", AdminServiceDetailView.as_view(), name="admin-service-detail"),
    path("admin/services/<slug:slug>/availability/", AdminServiceAvailabilityView.as_view(), name="admin-service-availability"),
    path("admin/inquiries/", AdminInquiryListView.as_view(), name="admin-inquiry-list"),
    path("admin/inquiries/<int:pk>/", AdminInquiryUpdateView.as_view(), name="admin-inquiry-update"),
]
