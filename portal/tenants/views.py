from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect

from .services import get_my_tenants


@login_required
def switch_tenant(request):
    """
    Sets which tenant the signed-in user is currently working in
    (server-side session state, not client-side/localStorage this time).
    Never trusts the posted tenant_id on its own — only accepts one the
    user actually has live Graph-verified access to.
    """
    tenant_id = request.GET.get("tenant_id")
    my_tenant_ids = {str(t.pk) for t in get_my_tenants(request.user)}
    if tenant_id in my_tenant_ids:
        request.session["current_tenant_id"] = int(tenant_id)
    return HttpResponseRedirect(request.META.get("HTTP_REFERER", "/"))
