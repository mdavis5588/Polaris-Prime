"""
Maps the portal's canonical Resource Group / Subnet / NSG / deployment
operations onto real Azure Resource Manager, Network, and Compute
resources, using a tenant's Azure service principal. Ported from the
earlier Node version's azureProvider.ts + azureDeploymentProvider.ts, with
one addition: create_resource_group also creates a VNet, since the
on-prem side models a Resource Group as one VLAN that subnets get carved
out of (see onprem.py) — the Node version left VNet creation out
entirely, but this portal needs both targets to expose the same
"resource group holds subnets" shape.

Every top-level resource this provider creates also gets stamped with
polaris:tenant / polaris:resource_group (and polaris:deployment, for
VMs/NICs) tags — see _polaris_tags() — so Orion (finops) can attribute
real Azure Cost Management numbers back to the same tenant/RG/server
hierarchy Postgres already tracks, without a separate mapping to keep in
sync. Subnets are skipped: they're an ARM child resource and don't
support tags of their own.
"""

from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.resource.resources import ResourceManagementClient

from tenants.models import Tenant

from .base import (
    DeploymentProvider,
    DeploymentResult,
    DeploymentSpec,
    DiscoveredDeployment,
    DiscoveredNsg,
    DiscoveredResourceGroup,
    DiscoveredSubnet,
    NetworkProvider,
    ProviderNotConfigured,
    RuleSpec,
    SubnetResult,
)

_PROTOCOL_MAP = {"tcp": "Tcp", "udp": "Udp", "*": "*"}
_REVERSE_PROTOCOL_MAP = {"Tcp": "tcp", "Udp": "udp", "*": "*"}

# A generic, well-known default so a deployment works out of the box
# without asking the user to pick a marketplace image for a plain IaaS VM.
_DEFAULT_IMAGE = {
    "publisher": "Canonical",
    "offer": "0001-com-ubuntu-server-jammy",
    "sku": "22_04-lts-gen2",
    "version": "latest",
}

_VNET_ADDRESS_SPACE = "10.0.0.0/16"
_DEFAULT_SUBNET_PREFIX_LENGTH = 24


def _resource_group_name_from_id(resource_id: str) -> str:
    """Resource group external ids are stored as full ARM resource ids (/subscriptions/.../resourceGroups/<name>); parsing the name back out avoids separately tracking which resource group an id belongs to."""
    parts = resource_id.split("/")
    for i, part in enumerate(parts):
        if part.lower() == "resourcegroups":
            return parts[i + 1]
    raise ValueError(f"Could not parse resource group name from id: {resource_id}")


def _last_segment(resource_id: str) -> str:
    return resource_id.rstrip("/").split("/")[-1]


def _polaris_tags(tenant_slug: str, rg_name: str, deployment_name: str | None = None) -> dict:
    """
    Stamped onto every top-level Azure resource this provider creates
    (subnets are a child resource and don't support tags in ARM, so they're
    skipped). Orion (finops) reads these back via Azure Cost Management's
    tag-based cost queries to attribute a resource's cost to the right
    tenant/resource-group/server without having to separately maintain that
    mapping on the Azure side — the ResourceGroup/ServiceDeployment rows in
    Postgres are the source of truth, these tags are just how that same
    hierarchy gets expressed on the Azure resource itself.
    """
    tags = {"polaris:tenant": tenant_slug, "polaris:resource_group": rg_name, "managedBy": "polaris-prime-networking"}
    if deployment_name:
        tags["polaris:deployment"] = deployment_name
    return tags


class AzureCredentials:
    """Reads a tenant's Azure service principal — subscription/tenant/client id from the Tenant row, the secret from the environment (see Tenant.get_azure_client_secret)."""

    def __init__(self, tenant: Tenant):
        if not tenant.has_azure:
            raise ProviderNotConfigured(f"Tenant {tenant} has no Azure account configured.")
        secret = tenant.get_azure_client_secret()
        if not secret:
            raise ProviderNotConfigured(
                f"Tenant {tenant} has Azure fields set but no client secret in the environment "
                f"(expected TENANT_{tenant.tenant_id.upper().replace('-', '_')}_AZURE_CLIENT_SECRET)."
            )
        self.subscription_id = tenant.azure_subscription_id
        self.location = tenant.azure_location
        self.subnet_id = tenant.azure_subnet_id
        self.credential = ClientSecretCredential(tenant.azure_tenant_id, tenant.azure_client_id, secret)


class AzureNetworkProvider(NetworkProvider):
    def __init__(self, tenant: Tenant):
        creds = AzureCredentials(tenant)
        self._location = creds.location
        self._tenant_slug = tenant.tenant_id
        self._resource_client = ResourceManagementClient(creds.credential, creds.subscription_id)
        self._network_client = NetworkManagementClient(creds.credential, creds.subscription_id)

    def create_resource_group(self, name: str) -> str:
        tags = _polaris_tags(self._tenant_slug, name)
        rg = self._resource_client.resource_groups.create_or_update(name, {"location": self._location, "tags": tags})
        self._network_client.virtual_networks.begin_create_or_update(
            name,
            f"{name}-vnet",
            {"location": self._location, "address_space": {"address_prefixes": [_VNET_ADDRESS_SPACE]}, "tags": tags},
        ).result()
        return rg.id

    def delete_resource_group(self, external_id: str) -> None:
        self._resource_client.resource_groups.begin_delete(_resource_group_name_from_id(external_id)).result()

    def list_resource_groups(self) -> list[DiscoveredResourceGroup]:
        """
        Everything this tenant's service principal has RBAC visibility
        into within the shared subscription — with one subscription
        holding every tenant's resource groups, RBAC (role assignments
        scoped to specific resource groups, not the whole subscription)
        is what has to do the tenant-scoping, not anything this call
        does. A service principal with subscription-wide access would see
        every tenant's resource groups here, tags or no tags.
        """
        return [DiscoveredResourceGroup(external_id=rg.id, name=rg.name) for rg in self._resource_client.resource_groups.list()]

    def create_subnet(self, resource_group_external_id: str, name: str) -> SubnetResult:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        existing = list(self._network_client.subnets.list(rg_name, f"{rg_name}-vnet"))
        prefix = f"10.0.{len(existing)}.0/{_DEFAULT_SUBNET_PREFIX_LENGTH}"
        subnet = self._network_client.subnets.begin_create_or_update(
            rg_name, f"{rg_name}-vnet", name, {"address_prefix": prefix}
        ).result()
        return SubnetResult(external_id=subnet.id, cidr=prefix)

    def delete_subnet(self, resource_group_external_id: str, external_id: str) -> None:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        self._network_client.subnets.begin_delete(rg_name, f"{rg_name}-vnet", _last_segment(external_id)).result()

    def list_subnets(self, resource_group_external_id: str) -> list[DiscoveredSubnet]:
        """
        Every subnet in every VNet in the resource group — not just the
        single `{rg_name}-vnet` this provider itself creates, since a
        discovered/imported resource group may have any VNet layout at
        all.
        """
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        discovered = []
        for vnet in self._network_client.virtual_networks.list(rg_name):
            for subnet in self._network_client.subnets.list(rg_name, vnet.name):
                discovered.append(DiscoveredSubnet(external_id=subnet.id, name=subnet.name, cidr=subnet.address_prefix or ""))
        return discovered

    def create_nsg(self, resource_group_external_id: str, name: str) -> str:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        nsg = self._network_client.network_security_groups.begin_create_or_update(
            rg_name, name, {"location": self._location, "tags": _polaris_tags(self._tenant_slug, rg_name)}
        ).result()
        return nsg.id

    def delete_nsg(self, external_id: str) -> None:
        rg_name = _resource_group_name_from_id(external_id)
        self._network_client.network_security_groups.begin_delete(rg_name, _last_segment(external_id)).result()

    def list_nsgs(self, resource_group_external_id: str) -> list[DiscoveredNsg]:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        return [
            DiscoveredNsg(external_id=nsg.id, name=nsg.name)
            for nsg in self._network_client.network_security_groups.list(rg_name)
        ]

    def add_rule(self, nsg_external_id: str, rule: RuleSpec) -> None:
        rg_name = _resource_group_name_from_id(nsg_external_id)
        nsg_name = _last_segment(nsg_external_id)
        self._network_client.security_rules.begin_create_or_update(
            rg_name,
            nsg_name,
            rule.name,
            {
                "priority": rule.priority,
                "direction": "Inbound" if rule.direction == "inbound" else "Outbound",
                "access": "Allow" if rule.access == "allow" else "Deny",
                "protocol": _PROTOCOL_MAP[rule.protocol],
                "source_address_prefix": rule.source_address_prefix,
                "source_port_range": rule.source_port_range,
                "destination_address_prefix": rule.destination_address_prefix,
                "destination_port_range": rule.destination_port_range,
            },
        ).result()

    def remove_rule(self, nsg_external_id: str, rule_name: str) -> None:
        rg_name = _resource_group_name_from_id(nsg_external_id)
        nsg_name = _last_segment(nsg_external_id)
        self._network_client.security_rules.begin_delete(rg_name, nsg_name, rule_name).result()

    def list_rules(self, nsg_external_id: str) -> list[RuleSpec]:
        """Azure's security_rules.list only returns custom rules — the NSG's built-in default_security_rules (AllowVnetInBound etc.) are a separate API and aren't included here, matching how this provider never lets Polaris manage them."""
        rg_name = _resource_group_name_from_id(nsg_external_id)
        nsg_name = _last_segment(nsg_external_id)
        discovered = []
        for rule in self._network_client.security_rules.list(rg_name, nsg_name):
            discovered.append(
                RuleSpec(
                    name=rule.name,
                    priority=rule.priority,
                    direction="inbound" if rule.direction == "Inbound" else "outbound",
                    access="allow" if rule.access == "Allow" else "deny",
                    protocol=_REVERSE_PROTOCOL_MAP.get(rule.protocol, "*"),
                    source_address_prefix=rule.source_address_prefix or "*",
                    source_port_range=rule.source_port_range or "*",
                    destination_address_prefix=rule.destination_address_prefix or "*",
                    destination_port_range=rule.destination_port_range or "*",
                )
            )
        return discovered


class AzureDeploymentProvider(DeploymentProvider):
    """Deploys a service as an Azure IaaS VM into the given resource group. Optionally attaches an NSG to the VM's NIC."""

    def __init__(self, tenant: Tenant):
        creds = AzureCredentials(tenant)
        self._location = creds.location
        self._subnet_id = creds.subnet_id
        self._tenant_id = tenant.azure_tenant_id
        self._tenant_slug = tenant.tenant_id
        self._network_client = NetworkManagementClient(creds.credential, creds.subscription_id)
        self._compute_client = ComputeManagementClient(creds.credential, creds.subscription_id)

    def create_deployment(self, resource_group_external_id: str, spec: DeploymentSpec) -> DeploymentResult:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        nic_name = f"{spec.name}-nic"
        tags = _polaris_tags(self._tenant_slug, rg_name, spec.name)

        nic = self._network_client.network_interfaces.begin_create_or_update(
            rg_name,
            nic_name,
            {
                "location": self._location,
                "ip_configurations": [{"name": f"{spec.name}-ipconfig", "subnet": {"id": self._subnet_id}}],
                "network_security_group": {"id": spec.nsg_external_id} if spec.nsg_external_id else None,
                "tags": tags,
            },
        ).result()

        vm = self._compute_client.virtual_machines.begin_create_or_update(
            rg_name,
            spec.name,
            {
                "location": self._location,
                "hardware_profile": {"vm_size": spec.vm_size},
                "storage_profile": {"image_reference": _DEFAULT_IMAGE},
                "os_profile": {
                    "computer_name": spec.name,
                    "admin_username": spec.admin_username,
                    "admin_password": spec.admin_password,
                },
                "network_profile": {"network_interfaces": [{"id": nic.id, "primary": True}]},
                "tags": tags,
            },
        ).result()

        console_url = f"https://portal.azure.com/#@{self._tenant_id}/resource{vm.id}/overview"
        return DeploymentResult(external_id=vm.id, console_url=console_url)

    def delete_deployment(self, resource_group_external_id: str, external_id: str) -> None:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        vm_name = _last_segment(external_id)
        self._compute_client.virtual_machines.begin_delete(rg_name, vm_name).result()
        # The NIC created alongside the VM is left behind intentionally —
        # deleting it requires knowing it's not in use by anything else,
        # and ARM will refuse resource group deletion with orphaned NICs
        # attached to nothing, not the other way around.

    def list_deployments(self, resource_group_external_id: str) -> list[DiscoveredDeployment]:
        """
        Every VM in the resource group, with vcpu/ram_gb inferred from an
        Azure-published vm_size -> {cores, memory} lookup (VMs don't
        report their own spec directly) and storage_gb summed from the OS
        disk plus any data disks. Best-effort on the NSG attachment — only
        the primary NIC's first IP config is checked, matching how this
        provider's own create_deployment only ever creates one.
        """
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        size_specs = {size.name: size for size in self._compute_client.virtual_machine_sizes.list(self._location)}

        discovered = []
        for vm in self._compute_client.virtual_machines.list(rg_name):
            size = size_specs.get(vm.hardware_profile.vm_size) if vm.hardware_profile else None
            vcpu = size.number_of_cores if size else 0
            ram_gb = round(size.memory_in_mb / 1024) if size else 0

            storage_gb = 0
            if vm.storage_profile:
                if vm.storage_profile.os_disk and vm.storage_profile.os_disk.disk_size_gb:
                    storage_gb += vm.storage_profile.os_disk.disk_size_gb
                for data_disk in vm.storage_profile.data_disks or []:
                    if data_disk.disk_size_gb:
                        storage_gb += data_disk.disk_size_gb

            nsg_external_id = None
            if vm.network_profile and vm.network_profile.network_interfaces:
                nic_id = vm.network_profile.network_interfaces[0].id
                nic = self._network_client.network_interfaces.get(_resource_group_name_from_id(nic_id), _last_segment(nic_id))
                if nic.network_security_group:
                    nsg_external_id = nic.network_security_group.id

            discovered.append(
                DiscoveredDeployment(
                    external_id=vm.id,
                    name=vm.name,
                    vm_size=vm.hardware_profile.vm_size if vm.hardware_profile else "",
                    admin_username=(vm.os_profile.admin_username if vm.os_profile else "") or "",
                    vcpu=vcpu,
                    ram_gb=ram_gb,
                    storage_gb=storage_gb,
                    console_url=f"https://portal.azure.com/#@{self._tenant_id}/resource{vm.id}/overview",
                    nsg_external_id=nsg_external_id,
                )
            )
        return discovered
