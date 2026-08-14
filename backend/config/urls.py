import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

def health_live(request):
    return JsonResponse({"status": "ok"})


def health_ready(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    executor = MigrationExecutor(connection)
    pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
    if pending:
        return JsonResponse({"status": "not_ready", "database": "reachable", "pending_migrations": len(pending)}, status=503)
    return JsonResponse({"status": "ok", "database": "reachable", "pending_migrations": 0})


def homepage(request):
    return redirect(os.getenv("FRONTEND_URL", "http://localhost:3001"))


urlpatterns = [
    path("", homepage, name="homepage"),
    path("health/", health_ready, name="health"),
    path("health/live/", health_live, name="health-live"),
    path("health/ready/", health_ready, name="health-ready"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/villas/", include("apps.villas.urls")),
    path("api/v1/bookings/", include("apps.bookings.urls")),
    path("api/v1/marketplace/", include("apps.marketplace.urls")),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
