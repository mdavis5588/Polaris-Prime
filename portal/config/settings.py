"""
Django settings for the Polaris Prime portal.

See https://docs.djangoproject.com/en/5.2/topics/settings/ for the full
list of settings and their meaning.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me")

DEBUG = env_bool("DJANGO_DEBUG", True)

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "django_htmx",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.microsoft",
    "accounts",
    "catalog",
    "tenants",
    "networking",
    "dashboard",
    "finops",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_htmx.middleware.HtmxMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# Real PostgreSQL always — no SQLite fallback. This project deliberately
# avoids the ephemeral in-memory-database gotcha the earlier Backstage
# version hit (signing keys/catalog state wiped on every restart); see
# docker-compose.yml for a one-command local Postgres.

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "polaris_portal"),
        "USER": os.environ.get("POSTGRES_USER", "polaris"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "polaris"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internationalization

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# Static files

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --- Auth / django-allauth ---
# Guest-free by design: unlike the earlier Backstage version there's no
# anonymous fallback identity. Microsoft (Entra ID / Azure AD) is the only
# sign-in method, since tenant access is gated by real AD group
# membership — see tenants/graph.py.

SITE_ID = 1

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*"]
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_ADAPTER = "accounts.adapter.SocialAccountAdapter"

# Left empty (not commented out, since SOCIALACCOUNT_PROVIDERS must exist
# as a dict either way) until AZURE_AD_* env vars are set — see
# .env.example. django-allauth simply won't offer Microsoft sign-in until
# an app is actually configured here.
_azure_client_id = os.environ.get("AZURE_AD_CLIENT_ID")
_azure_client_secret = os.environ.get("AZURE_AD_CLIENT_SECRET")
_azure_tenant_id = os.environ.get("AZURE_AD_TENANT_ID")

SOCIALACCOUNT_PROVIDERS = {}
if _azure_client_id and _azure_client_secret and _azure_tenant_id:
    SOCIALACCOUNT_PROVIDERS["microsoft"] = {
        "APPS": [
            {
                "client_id": _azure_client_id,
                "secret": _azure_client_secret,
                "settings": {"tenant": _azure_tenant_id},
            }
        ],
    }


# --- Platform tenants: Microsoft Graph app-only credentials for live
# AD-group membership checks (tenants/graph.py). Can reuse the same app
# registration as sign-in above, or a separate one — either way it needs
# the GroupMember.Read.All (or Directory.Read.All) Graph API APPLICATION
# permission, admin-consented in your Azure AD tenant.

GRAPH_CLIENT_ID = os.environ.get("AZURE_AD_GRAPH_CLIENT_ID", _azure_client_id)
GRAPH_CLIENT_SECRET = os.environ.get("AZURE_AD_GRAPH_CLIENT_SECRET", _azure_client_secret)
GRAPH_TENANT_ID = _azure_tenant_id
