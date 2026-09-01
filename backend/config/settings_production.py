import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403

DEBUG = False

raw_database_url = os.getenv("DATABASE_URL", "").strip()
if not raw_database_url or "replace-with" in raw_database_url.lower():
    raise ImproperlyConfigured("Production DATABASE_URL must use a real PostgreSQL password.")
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":  # noqa: F405
    raise ImproperlyConfigured("Production requires PostgreSQL through DATABASE_URL.")
if PAYMENT_MOCK_ENABLED or OTP_DEBUG_CODE:  # noqa: F405
    raise ImproperlyConfigured("Mock payment and OTP debug output must be disabled in production.")
if any("villaone.example" in value for value in [*ALLOWED_HOSTS, *CORS_ALLOWED_ORIGINS, *CSRF_TRUSTED_ORIGINS]):  # noqa: F405
    raise ImproperlyConfigured("Replace villaone.example with the real production domain.")

for storage_path in (Path(MEDIA_ROOT), Path(PRIVATE_MEDIA_ROOT)):  # noqa: F405
    if not storage_path.exists() or not os.access(storage_path, os.W_OK):
        raise ImproperlyConfigured(f"Persistent writable storage is required: {storage_path}")

SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=SENTRY_DSN, environment=os.getenv("SENTRY_ENVIRONMENT", "production"), send_default_pii=False, traces_sample_rate=0.05)
