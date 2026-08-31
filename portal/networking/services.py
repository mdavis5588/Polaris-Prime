"""
Provider dispatch (pick Azure vs on-prem/NetBox for a tenant+target) and
the create/delete actions views call — each action writes a "pending" row
first, calls the provider, then marks the row active/failed so the UI can
show in-progress state without blocking the request on the provider call.
"""

from django.conf import settings
from tenants.models import Tenant

from .models import NetworkSecurityGroup, NsgRule, ProvisioningStatus, ResourceGroup, ServiceDeployment, Subnet
from .providers.azure import AzureDeploymentProvider, AzureNetworkProvider
from .providers.base import DeploymentProvider, DeploymentSpec, NetworkProvider, ProviderNotConfigured, RuleSpec
from .providers.mock import MockDeploymentProvider, MockNetworkProvider
from .providers.onprem import OnPremDeploymentProvider, OnPremNetworkProvider


def get_network_provider(tenant: Tenant, target: str) -> NetworkProvider:
    if target == "onprem":
        return OnPremNetworkProvider(tenant.netbox_site_id)
    if settings.AZURE_MOCK_MODE:
        return MockNetworkProvider()
    return AzureNetworkProvider(tenant)


def get_deployment_provider(tenant: Tenant, target: str) -> DeploymentProvider:
    if target == "onprem":
        return OnPremDeploymentProvider()
    if settings.AZURE_MOCK_MODE:
        return MockDeploymentProvider()
    return AzureDeploymentProvider(tenant)


def _run(row, action):
    try:
        action()
        row.status = ProvisioningStatus.ACTIVE
    except Exception as exc:  # noqa: BLE001 — provider failures are reported on the row, not raised to the view
        row.status = ProvisioningStatus.FAILED
        row.error = str(exc)
    row.save()


def create_resource_group(tenant: Tenant, target: str, name: str, description: str = "") -> ResourceGroup:
    rg = ResourceGroup.objects.create(tenant=tenant, target=target, name=name, description=description)

    def action():
        provider = get_network_provider(tenant, target)
        rg.external_id = provider.create_resource_group(name)

    _run(rg, action)
    return rg


def delete_resource_group(rg: ResourceGroup) -> None:
    if rg.external_id and rg.status != ProvisioningStatus.GONE:
        provider = get_network_provider(rg.tenant, rg.target)
        provider.delete_resource_group(rg.external_id)
    rg.delete()


def _unique_name(queryset, name: str) -> str:
    candidate = name
    suffix = 1
    while queryset.filter(name=candidate).exists():
        suffix += 1
        candidate = f"{name}-{suffix}"
    return candidate


def reconcile_resource_groups(tenant: Tenant, target: str) -> dict:
    """
    Full two-way sync against the real provider for every resource group
    (and their subnets/NSGs/rules/deployments) this tenant+target has —
    imports anything the provider reports that Polaris doesn't track yet
    (matched by external_id; name collisions get disambiguated), and
    marks anything Polaris tracks as ACTIVE that the provider no longer
    reports as ProvisioningStatus.GONE. Never a hard delete: a GONE row
    stays in Postgres as an audit trail and is excluded from Orion's cost
    totals (see finops/services.py) rather than disappearing outright.
    When a resource group itself goes GONE, its still-ACTIVE
    subnets/NSGs/rules/deployments are cascaded to GONE in the same pass
    rather than left stale pointing at a parent that no longer exists.

    On-prem deployments are skipped entirely — OnPremDeploymentProvider
    has no orchestrator to enumerate them against (see providers/onprem.py)
    and raises ProviderNotConfigured, which this catches and treats as
    "nothing to compare, leave tracked rows alone" rather than as "there
    are none" (an empty list would otherwise wrongly mark every tracked
    on-prem deployment GONE).
    """
    network_provider = get_network_provider(tenant, target)

    imported_rgs: list[ResourceGroup] = []
    gone_rgs: list[ResourceGroup] = []
    imported_children = 0
    gone_children = 0
    available = True

    try:
        discovered_rgs = network_provider.list_resource_groups()
    except ProviderNotConfigured:
        # Nothing real to check against (e.g. AZURE_MOCK_MODE — see
        # providers/mock.py) — skip reconciliation entirely rather than
        # treating "can't enumerate" as "there are none" and marking
        # every tracked resource group GONE.
        return {
            "imported_rgs": imported_rgs,
            "gone_rgs": gone_rgs,
            "imported_children": imported_children,
            "gone_children": gone_children,
            "available": False,
        }

    discovered_rg_ids = {rg.external_id for rg in discovered_rgs}
    known_rg_ids = set(ResourceGroup.objects.filter(tenant=tenant, target=target).values_list("external_id", flat=True))

    for found in discovered_rgs:
        if found.external_id in known_rg_ids:
            continue
        name = _unique_name(ResourceGroup.objects.filter(tenant=tenant), found.name)
        imported_rgs.append(
            ResourceGroup.objects.create(
                tenant=tenant, target=target, name=name, external_id=found.external_id, status=ProvisioningStatus.ACTIVE
            )
        )

    for rg in ResourceGroup.objects.filter(tenant=tenant, target=target, status=ProvisioningStatus.ACTIVE):
        if rg.external_id not in discovered_rg_ids:
            rg.status = ProvisioningStatus.GONE
            rg.save(update_fields=["status"])
            gone_rgs.append(rg)
            rg.subnets.filter(status=ProvisioningStatus.ACTIVE).update(status=ProvisioningStatus.GONE)
            rg.nsgs.filter(status=ProvisioningStatus.ACTIVE).update(status=ProvisioningStatus.GONE)
            NsgRule.objects.filter(nsg__resource_group=rg, status=ProvisioningStatus.ACTIVE).update(status=ProvisioningStatus.GONE)
            rg.deployments.filter(status=ProvisioningStatus.ACTIVE).update(status=ProvisioningStatus.GONE)

    for rg in ResourceGroup.objects.filter(tenant=tenant, target=target, status=ProvisioningStatus.ACTIVE):
        added, removed = _reconcile_children(network_provider, tenant, target, rg)
        imported_children += added
        gone_children += removed

    return {
        "imported_rgs": imported_rgs,
        "gone_rgs": gone_rgs,
        "imported_children": imported_children,
        "gone_children": gone_children,
        "available": available,
    }


def _reconcile_children(network_provider: NetworkProvider, tenant: Tenant, target: str, rg: ResourceGroup) -> tuple[int, int]:
    added = 0
    removed = 0

    discovered_subnets = network_provider.list_subnets(rg.external_id)
    discovered_subnet_ids = {s.external_id for s in discovered_subnets}
    known_subnet_ids = set(rg.subnets.values_list("external_id", flat=True))
    for found in discovered_subnets:
        if found.external_id in known_subnet_ids:
            continue
        Subnet.objects.create(
            resource_group=rg,
            name=_unique_name(rg.subnets, found.name),
            cidr=found.cidr,
            external_id=found.external_id,
            status=ProvisioningStatus.ACTIVE,
        )
        added += 1
    gone = rg.subnets.filter(status=ProvisioningStatus.ACTIVE).exclude(external_id__in=discovered_subnet_ids)
    removed += gone.count()
    gone.update(status=ProvisioningStatus.GONE)

    discovered_nsgs = network_provider.list_nsgs(rg.external_id)
    discovered_nsg_ids = {n.external_id for n in discovered_nsgs}
    known_nsg_ids = set(rg.nsgs.values_list("external_id", flat=True))
    for found in discovered_nsgs:
        if found.external_id in known_nsg_ids:
            continue
        NetworkSecurityGroup.objects.create(
            resource_group=rg, name=_unique_name(rg.nsgs, found.name), external_id=found.external_id, status=ProvisioningStatus.ACTIVE
        )
        added += 1
    gone = rg.nsgs.filter(status=ProvisioningStatus.ACTIVE).exclude(external_id__in=discovered_nsg_ids)
    removed += gone.count()
    gone.update(status=ProvisioningStatus.GONE)

    for nsg in rg.nsgs.filter(status=ProvisioningStatus.ACTIVE):
        discovered_rules = network_provider.list_rules(nsg.external_id)
        discovered_rule_names = {r.name for r in discovered_rules}
        known_rule_names = set(nsg.rules.values_list("name", flat=True))
        for rule in discovered_rules:
            if rule.name in known_rule_names:
                continue
            NsgRule.objects.create(
                nsg=nsg,
                name=rule.name,
                priority=rule.priority,
                direction=rule.direction,
                access=rule.access,
                protocol=rule.protocol,
                source_address_prefix=rule.source_address_prefix,
                source_port_range=rule.source_port_range,
                destination_address_prefix=rule.destination_address_prefix,
                destination_port_range=rule.destination_port_range,
                status=ProvisioningStatus.ACTIVE,
            )
            added += 1
        gone = nsg.rules.filter(status=ProvisioningStatus.ACTIVE).exclude(name__in=discovered_rule_names)
        removed += gone.count()
        gone.update(status=ProvisioningStatus.GONE)

    deployment_provider = get_deployment_provider(tenant, target)
    try:
        discovered_deployments = deployment_provider.list_deployments(rg.external_id)
    except ProviderNotConfigured:
        pass
    else:
        discovered_dep_ids = {d.external_id for d in discovered_deployments}
        known_dep_ids = set(rg.deployments.values_list("external_id", flat=True))
        nsg_by_external_id = {n.external_id: n for n in rg.nsgs.all()}
        for found in discovered_deployments:
            if found.external_id in known_dep_ids:
                continue
            ServiceDeployment.objects.create(
                resource_group=rg,
                nsg=nsg_by_external_id.get(found.nsg_external_id),
                name=_unique_name(rg.deployments, found.name),
                vm_size=found.vm_size,
                admin_username=found.admin_username,
                vcpu=found.vcpu,
                ram_gb=found.ram_gb,
                storage_gb=found.storage_gb,
                external_id=found.external_id,
                console_url=found.console_url,
                status=ProvisioningStatus.ACTIVE,
            )
            added += 1
        gone = rg.deployments.filter(status=ProvisioningStatus.ACTIVE).exclude(external_id__in=discovered_dep_ids)
        removed += gone.count()
        gone.update(status=ProvisioningStatus.GONE)

    return added, removed


def create_subnet(rg: ResourceGroup, name: str) -> Subnet:
    subnet = Subnet.objects.create(resource_group=rg, name=name)

    def action():
        provider = get_network_provider(rg.tenant, rg.target)
        result = provider.create_subnet(rg.external_id, name)
        subnet.external_id = result.external_id
        subnet.cidr = result.cidr

    _run(subnet, action)
    return subnet


def delete_subnet(subnet: Subnet) -> None:
    rg = subnet.resource_group
    if subnet.external_id and subnet.status != ProvisioningStatus.GONE:
        provider = get_network_provider(rg.tenant, rg.target)
        provider.delete_subnet(rg.external_id, subnet.external_id)
    subnet.delete()


def create_nsg(rg: ResourceGroup, name: str) -> NetworkSecurityGroup:
    nsg = NetworkSecurityGroup.objects.create(resource_group=rg, name=name)

    def action():
        provider = get_network_provider(rg.tenant, rg.target)
        nsg.external_id = provider.create_nsg(rg.external_id, name)

    _run(nsg, action)
    return nsg


def delete_nsg(nsg: NetworkSecurityGroup) -> None:
    rg = nsg.resource_group
    if nsg.external_id and nsg.status != ProvisioningStatus.GONE:
        provider = get_network_provider(rg.tenant, rg.target)
        provider.delete_nsg(nsg.external_id)
    nsg.delete()


def add_rule(nsg: NetworkSecurityGroup, **rule_fields) -> NsgRule:
    rule = NsgRule.objects.create(nsg=nsg, **rule_fields)

    def action():
        rg = nsg.resource_group
        provider = get_network_provider(rg.tenant, rg.target)
        provider.add_rule(
            nsg.external_id,
            RuleSpec(
                name=rule.name,
                priority=rule.priority,
                direction=rule.direction,
                access=rule.access,
                protocol=rule.protocol,
                source_address_prefix=rule.source_address_prefix,
                source_port_range=rule.source_port_range,
                destination_address_prefix=rule.destination_address_prefix,
                destination_port_range=rule.destination_port_range,
            ),
        )

    _run(rule, action)
    return rule


def delete_rule(rule: NsgRule) -> None:
    nsg = rule.nsg
    if nsg.external_id and rule.status != ProvisioningStatus.GONE and nsg.status != ProvisioningStatus.GONE:
        rg = nsg.resource_group
        provider = get_network_provider(rg.tenant, rg.target)
        provider.remove_rule(nsg.external_id, rule.name)
    rule.delete()


def create_deployment(
    rg: ResourceGroup,
    nsg: NetworkSecurityGroup | None,
    name: str,
    vm_size: str,
    admin_username: str,
    admin_password: str,
    vcpu: int,
    ram_gb: int,
    storage_gb: int,
    is_managed: bool = False,
) -> ServiceDeployment:
    deployment = ServiceDeployment.objects.create(
        resource_group=rg,
        nsg=nsg,
        name=name,
        vm_size=vm_size,
        admin_username=admin_username,
        vcpu=vcpu,
        ram_gb=ram_gb,
        storage_gb=storage_gb,
        is_managed=is_managed,
    )

    def action():
        provider = get_deployment_provider(rg.tenant, rg.target)
        result = provider.create_deployment(
            rg.external_id,
            DeploymentSpec(
                name=name,
                vm_size=vm_size,
                admin_username=admin_username,
                admin_password=admin_password,
                nsg_external_id=nsg.external_id if nsg else None,
            ),
        )
        deployment.external_id = result.external_id
        deployment.console_url = result.console_url

    _run(deployment, action)
    return deployment


def delete_deployment(deployment: ServiceDeployment) -> None:
    rg = deployment.resource_group
    if deployment.external_id and deployment.status != ProvisioningStatus.GONE:
        provider = get_deployment_provider(rg.tenant, rg.target)
        provider.delete_deployment(rg.external_id, deployment.external_id)
    deployment.delete()
