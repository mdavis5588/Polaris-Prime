from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from tenants.services import get_current_tenant

from networking.models import ResourceGroup

from . import services
from .models import OnPremRateCard

_RATE_FIELDS = ["vcpu_monthly_rate", "ram_gb_monthly_rate", "storage_gb_monthly_rate", "managed_service_monthly_rate"]


@login_required
def index(request):
    tenant = get_current_tenant(request)
    rg_costs = []
    tenant_total = azure_total = onprem_total = None
    if tenant:
        rg_costs = [(rg, services.get_resource_group_cost(rg)) for rg in tenant.resource_groups.all()]
        tenant_total = services.sum_costs(cost for _, cost in rg_costs)
        azure_total = services.sum_costs(cost for rg, cost in rg_costs if rg.target == "azure")
        onprem_total = services.sum_costs(cost for rg, cost in rg_costs if rg.target == "onprem")
    return render(
        request,
        "finops/index.html",
        {"rg_costs": rg_costs, "tenant_total": tenant_total, "azure_total": azure_total, "onprem_total": onprem_total},
    )


@login_required
def resource_group_detail(request, pk):
    rg = get_object_or_404(ResourceGroup, pk=pk, tenant=get_current_tenant(request))
    server_costs = [(deployment, services.get_deployment_cost(deployment)) for deployment in rg.deployments.all()]
    return render(
        request,
        "finops/resource_group_detail.html",
        {"rg": rg, "server_costs": server_costs, "rg_total": services.get_resource_group_cost(rg)},
    )


@login_required
def rate_card(request):
    card = OnPremRateCard.get_current()
    if request.method == "POST":
        parsed = {}
        invalid = []
        for field in _RATE_FIELDS:
            raw = request.POST.get(field, "").strip()
            try:
                parsed[field] = Decimal(raw)
            except InvalidOperation:
                invalid.append(field)
        if invalid:
            messages.error(request, f"Couldn't save — invalid rate value for: {', '.join(invalid)}.")
        else:
            for field, value in parsed.items():
                setattr(card, field, value)
            card.save()
            messages.success(request, "Rate card updated.")
            return redirect("finops:rate_card")
    return render(request, "finops/rate_card.html", {"card": card})
