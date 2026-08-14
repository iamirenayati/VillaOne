import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "villaone-local-development-secret-key-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = [item.strip() for item in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",") if item.strip()]

if not DEBUG:
    if SECRET_KEY == "villaone-local-development-secret-key-change-me" or len(SECRET_KEY) < 50:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY امن برای محیط عملیاتی لازم است.")
    if not ALLOWED_HOSTS:
        raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS برای محیط عملیاتی لازم است.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "apps.accounts",
    "apps.villas",
    "apps.bookings",
    "apps.marketplace",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.RequestContextMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

database_url = os.getenv("DATABASE_URL")
DATABASES = {
    "default": dj_database_url.parse(database_url, conn_max_age=60, conn_health_checks=True)
    if database_url
    else {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
}

AUTH_PASSWORD_VALIDATORS = [] if DEBUG else [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fa-ir"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
PRIVATE_MEDIA_ROOT = BASE_DIR / "private-media"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = [item.strip() for item in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",") if item.strip()]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [item.strip() for item in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if item.strip()]

if not DEBUG and (not CORS_ALLOWED_ORIGINS or not CSRF_TRUSTED_ORIGINS):
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS و CSRF_TRUSTED_ORIGINS برای محیط عملیاتی لازم‌اند.")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",) if not DEBUG else (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "otp_request": "5/min",
        "otp_verify": "10/min",
        "booking_quote": "30/min",
        "booking_write": "10/min",
        "support_write": "10/min",
        "inquiry_write": "10/min",
        "admin_write": "30/min",
    },
    "EXCEPTION_HANDLER": "config.exceptions.villaone_exception_handler",
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "config.middleware.JsonFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "loggers": {
        "villaone": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO"), "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("REFRESH_TOKEN_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

OTP_DEBUG_CODE = os.getenv("OTP_DEBUG_CODE", "123456") if DEBUG else None
OTP_EXPIRY_SECONDS = 120
PAYMENT_MOCK_ENABLED = os.getenv("PAYMENT_MOCK_ENABLED", "false").lower() == "true"
BOOKING_HOLD_MINUTES = int(os.getenv("BOOKING_HOLD_MINUTES", "120"))

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "true").lower() == "true"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    X_FRAME_OPTIONS = "DENY"
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = os.getenv("SECURE_HSTS_PRELOAD", "false").lower() == "true"
