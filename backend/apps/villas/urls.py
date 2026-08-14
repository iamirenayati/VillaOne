from django.urls import path
from .views import AvailabilityAdminBulkUpdateView, AvailabilityAdminUpdateView, CityListView, FavoriteVillaListView, FavoriteVillaToggleView, PriceOverrideAdminUpdateView, VillaAdminListView, VillaAdminUpdateView, VillaAvailabilityView, VillaDetailView, VillaListView, VillaMapView, VillaReviewListView

urlpatterns = [
    path("cities/", CityListView.as_view(), name="city-list"),
    path("favorites/", FavoriteVillaListView.as_view(), name="favorite-list"),
    path("map/", VillaMapView.as_view(), name="villa-map"),
    path("admin/", VillaAdminListView.as_view(), name="villa-admin-list"),
    path("admin/<slug:slug>/availability/<str:day>/", AvailabilityAdminUpdateView.as_view(), name="availability-admin-update"),
    path("admin/<slug:slug>/availability-bulk/", AvailabilityAdminBulkUpdateView.as_view(), name="availability-admin-bulk-update"),
    path("admin/<slug:slug>/prices/<str:date>/", PriceOverrideAdminUpdateView.as_view(), name="price-override-admin-update"),
    path("admin/<slug:slug>/", VillaAdminUpdateView.as_view(), name="villa-admin-update"),
    path("<slug:slug>/favorite/", FavoriteVillaToggleView.as_view(), name="favorite-toggle"),
    path("", VillaListView.as_view(), name="villa-list"),
    path("<slug:slug>/", VillaDetailView.as_view(), name="villa-detail"),
    path("<slug:slug>/availability/", VillaAvailabilityView.as_view(), name="villa-availability"),
    path("<slug:slug>/reviews/", VillaReviewListView.as_view(), name="villa-reviews"),
]
