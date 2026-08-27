from django.contrib.auth.models import AbstractBaseUser
from django.core.cache import cache

from .graph import GraphNotConfigured, get_user_group_ids
from .models import Tenant

# Short-lived — long enough to avoid a Graph round-trip on every single
# page navigation, short enough that a just-changed AD group membership
# takes effect within a minute rather than requiring sign-out/sign-in.
_CACHE_TTL_SECONDS = 60


def get_ad_object_id(user: AbstractBaseUser) -> str | None:
    """The signed-in user's Azure AD object id — django-allauth stores
    this as the SocialAccount's `uid` (see MicrosoftGraphProvider.extract_uid)."""
    account = user.socialaccount_set.filter(provider="microsoft").first()
    return account.uid if account else None


def get_my_tenants(user: AbstractBaseUser) -> list[Tenant]:
    """
    The signed-in user's real, access-controlled tenant list — their AD
    object id's live Graph group memberships, cross-referenced against
    configured Tenant.ad_group_id values. Returns [] for anyone without a
    Microsoft account linked (including superusers signed in via the
    plain Django admin login) or if Graph isn't configured yet.
    """
    ad_object_id = get_ad_object_id(user)
    if not ad_object_id:
        return []

    cache_key = f"tenants:my_group_ids:{ad_object_id}"
    group_ids = cache.get(cache_key)
    if group_ids is None:
        try:
            group_ids = get_user_group_ids(ad_object_id)
        except GraphNotConfigured:
            return []
        cache.set(cache_key, group_ids, _CACHE_TTL_SECONDS)

    return list(Tenant.objects.select_related("client").filter(ad_group_id__in=group_ids))


def get_current_tenant(request) -> Tenant | None:
    """
    Which tenant the signed-in user is currently working in — the same
    resolution the tenant_context context processor uses (my_tenants
    cross-referenced against the session's current_tenant_id, falling
    back to the first accessible tenant). Views outside of template
    rendering (networking's, for scoping querysets) call this directly
    rather than relying on template context.
    """
    if not request.user.is_authenticated:
        return None

    my_tenants = get_my_tenants(request.user)
    current_id = request.session.get("current_tenant_id")
    current_tenant = next((t for t in my_tenants if t.pk == current_id), None)
    if current_tenant is None and my_tenants:
        current_tenant = my_tenants[0]
        request.session["current_tenant_id"] = current_tenant.pk
    return current_tenant
