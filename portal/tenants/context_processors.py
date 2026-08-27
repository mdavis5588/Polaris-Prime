from .services import get_current_tenant, get_my_tenants


def tenant_context(request):
    """
    Injects my_tenants (the signed-in user's real, access-controlled
    tenant list) and current_tenant (which one they're currently working
    in, tracked server-side in the session) into every template's
    context — this is how the sidebar's tenant switcher and any
    tenant-scoped page know what to show, without every view having to
    wire this up itself.
    """
    if not request.user.is_authenticated:
        return {}

    return {"my_tenants": get_my_tenants(request.user), "current_tenant": get_current_tenant(request)}
