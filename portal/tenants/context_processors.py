from .services import get_my_tenants


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

    my_tenants = get_my_tenants(request.user)

    current_tenant = None
    current_id = request.session.get("current_tenant_id")
    if current_id:
        current_tenant = next((t for t in my_tenants if t.pk == current_id), None)
    if current_tenant is None and my_tenants:
        current_tenant = my_tenants[0]
        request.session["current_tenant_id"] = current_tenant.pk

    return {"my_tenants": my_tenants, "current_tenant": current_tenant}
