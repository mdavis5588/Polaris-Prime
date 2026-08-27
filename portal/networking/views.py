from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from tenants.services import get_current_tenant

from . import services
from .models import ResourceGroup


@login_required
def index(request):
    tenant = get_current_tenant(request)
    resource_groups = ResourceGroup.objects.filter(tenant=tenant).prefetch_related("subnets", "nsgs") if tenant else []
    return render(request, "networking/index.html", {"resource_groups": resource_groups})


@login_required
def resource_group_create(request):
    tenant = get_current_tenant(request)
    if request.method == "POST" and tenant:
        name = request.POST.get("name", "").strip()
        description = request.POST.get("description", "").strip()
        target = request.POST.get("target")
        if target == "azure" and not tenant.has_azure:
            messages.error(request, "This tenant has no Azure account configured.")
        elif target == "onprem" and not tenant.has_onprem:
            messages.error(request, "This tenant has no on-prem resource pool configured.")
        elif name and target:
            rg = services.create_resource_group(tenant, target, name, description)
            if rg.status == "failed":
                messages.error(request, f'Failed to provision resource group "{name}": {rg.error}')
            else:
                messages.success(request, f'Resource group "{name}" created.')
    return redirect("networking:index")


@login_required
def resource_group_detail(request, pk):
    rg = get_object_or_404(ResourceGroup, pk=pk, tenant=get_current_tenant(request))
    return render(
        request,
        "networking/resource_group_detail.html",
        {
            "rg": rg,
            "subnets": rg.subnets.all(),
            "nsgs": rg.nsgs.all(),
            "deployments": rg.deployments.select_related("nsg").all(),
        },
    )


@login_required
def resource_group_delete(request, pk):
    rg = get_object_or_404(ResourceGroup, pk=pk, tenant=get_current_tenant(request))
    if request.method == "POST":
        name = rg.name
        services.delete_resource_group(rg)
        messages.success(request, f'Resource group "{name}" deleted.')
    return redirect("networking:index")


@login_required
def subnet_create(request, rg_pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        if name:
            subnet = services.create_subnet(rg, name)
            if subnet.status == "failed":
                messages.error(request, f'Failed to provision subnet "{name}": {subnet.error}')
    return redirect("networking:resource_group_detail", pk=rg.pk)


@login_required
def subnet_delete(request, rg_pk, pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    subnet = get_object_or_404(rg.subnets, pk=pk)
    if request.method == "POST":
        services.delete_subnet(subnet)
    return redirect("networking:resource_group_detail", pk=rg.pk)


@login_required
def nsg_create(request, rg_pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        if name:
            nsg = services.create_nsg(rg, name)
            if nsg.status == "failed":
                messages.error(request, f'Failed to provision NSG "{name}": {nsg.error}')
    return redirect("networking:resource_group_detail", pk=rg.pk)


@login_required
def nsg_delete(request, rg_pk, pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    nsg = get_object_or_404(rg.nsgs, pk=pk)
    if request.method == "POST":
        services.delete_nsg(nsg)
    return redirect("networking:resource_group_detail", pk=rg.pk)


@login_required
def nsg_detail(request, rg_pk, pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    nsg = get_object_or_404(rg.nsgs, pk=pk)
    return render(request, "networking/nsg_detail.html", {"rg": rg, "nsg": nsg, "rules": nsg.rules.all()})


@login_required
def rule_create(request, rg_pk, nsg_pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    nsg = get_object_or_404(rg.nsgs, pk=nsg_pk)
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        priority = request.POST.get("priority", "").strip()
        if name and priority.isdigit():
            rule = services.add_rule(
                nsg,
                name=name,
                priority=int(priority),
                direction=request.POST.get("direction", "inbound"),
                access=request.POST.get("access", "allow"),
                protocol=request.POST.get("protocol", "*"),
                source_address_prefix=request.POST.get("source_address_prefix", "*").strip() or "*",
                source_port_range=request.POST.get("source_port_range", "*").strip() or "*",
                destination_address_prefix=request.POST.get("destination_address_prefix", "*").strip() or "*",
                destination_port_range=request.POST.get("destination_port_range", "*").strip() or "*",
            )
            if rule.status == "failed":
                messages.error(request, f'Failed to provision rule "{name}": {rule.error}')
    return redirect("networking:nsg_detail", rg_pk=rg.pk, pk=nsg.pk)


@login_required
def rule_delete(request, rg_pk, nsg_pk, pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    nsg = get_object_or_404(rg.nsgs, pk=nsg_pk)
    rule = get_object_or_404(nsg.rules, pk=pk)
    if request.method == "POST":
        services.delete_rule(rule)
    return redirect("networking:nsg_detail", rg_pk=rg.pk, pk=nsg.pk)


@login_required
def deployment_create(request, rg_pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        vm_size = request.POST.get("vm_size", "").strip()
        admin_username = request.POST.get("admin_username", "").strip()
        admin_password = request.POST.get("admin_password", "")
        vcpu = request.POST.get("vcpu", "").strip()
        ram_gb = request.POST.get("ram_gb", "").strip()
        storage_gb = request.POST.get("storage_gb", "").strip()
        is_managed = request.POST.get("is_managed") == "on"
        nsg_pk = request.POST.get("nsg")
        nsg = get_object_or_404(rg.nsgs, pk=nsg_pk) if nsg_pk else None
        if (
            name
            and vm_size
            and admin_username
            and admin_password
            and vcpu.isdigit()
            and ram_gb.isdigit()
            and storage_gb.isdigit()
        ):
            deployment = services.create_deployment(
                rg, nsg, name, vm_size, admin_username, admin_password, int(vcpu), int(ram_gb), int(storage_gb), is_managed
            )
            if deployment.status == "failed":
                messages.error(request, f'Failed to deploy "{name}": {deployment.error}')
    return redirect("networking:resource_group_detail", pk=rg.pk)


@login_required
def deployment_delete(request, rg_pk, pk):
    rg = get_object_or_404(ResourceGroup, pk=rg_pk, tenant=get_current_tenant(request))
    deployment = get_object_or_404(rg.deployments, pk=pk)
    if request.method == "POST":
        services.delete_deployment(deployment)
    return redirect("networking:resource_group_detail", pk=rg.pk)
