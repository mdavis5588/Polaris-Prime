"""
Provider dispatch (pick Azure vs on-prem/NetBox for a tenant+target) and
the create/delete actions views call — each action writes a "pending" row
first, calls the provider, then marks the row active/failed so the UI can
show in-progress state without blocking the request on the provider call.
"""

from tenants.models import Tenant

from .models import NetworkSecurityGroup, NsgRule, ProvisioningStatus, ResourceGroup, ServiceDeployment, Subnet
from .providers.azure import AzureDeploymentProvider, AzureNetworkProvider
from .providers.base import DeploymentProvider, DeploymentSpec, NetworkProvider, RuleSpec
from .providers.onprem import OnPremDeploymentProvider, OnPremNetworkProvider


def get_network_provider(tenant: Tenant, target: str) -> NetworkProvider:
    if target == "onprem":
        return OnPremNetworkProvider(tenant.netbox_site_id)
    return AzureNetworkProvider(tenant)


def get_deployment_provider(tenant: Tenant, target: str) -> DeploymentProvider:
    if target == "onprem":
        return OnPremDeploymentProvider()
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
    if rg.external_id:
        provider = get_network_provider(rg.tenant, rg.target)
        provider.delete_resource_group(rg.external_id)
    rg.delete()


def discover_resource_groups(tenant: Tenant, target: str) -> list[ResourceGroup]:
    """
    Resource groups that exist for real (in Azure, or as NetBox VLANs)
    but weren't created through Polaris — access is what scopes these to
    the right tenant, not anything read here: a tenant's Azure service
    principal only sees what RBAC grants it in the shared subscription,
    and on-prem is scoped by Tenant.netbox_site_id. Anything already
    tracked (matched by external_id) is skipped; everything else is
    imported as a new, already-"active" ResourceGroup row so it shows up
    in Networking and gets costed in Orion.
    """
    provider = get_network_provider(tenant, target)
    known_external_ids = set(
        ResourceGroup.objects.filter(tenant=tenant, target=target).values_list("external_id", flat=True)
    )

    imported = []
    for found in provider.list_resource_groups():
        if found.external_id in known_external_ids:
            continue

        name = found.name
        suffix = 1
        while ResourceGroup.objects.filter(tenant=tenant, name=name).exists():
            suffix += 1
            name = f"{found.name}-{suffix}"

        imported.append(
            ResourceGroup.objects.create(
                tenant=tenant, target=target, name=name, external_id=found.external_id, status=ProvisioningStatus.ACTIVE
            )
        )
    return imported


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
    if subnet.external_id:
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
    if nsg.external_id:
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
    if nsg.external_id:
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
    if deployment.external_id:
        provider = get_deployment_provider(rg.tenant, rg.target)
        provider.delete_deployment(rg.external_id, deployment.external_id)
    deployment.delete()
