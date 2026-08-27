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
"""

from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.resource.resources import ResourceManagementClient

from tenants.models import Tenant

from .base import DeploymentProvider, DeploymentResult, DeploymentSpec, NetworkProvider, ProviderNotConfigured, RuleSpec, SubnetResult

_PROTOCOL_MAP = {"tcp": "Tcp", "udp": "Udp", "*": "*"}

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
        self._resource_client = ResourceManagementClient(creds.credential, creds.subscription_id)
        self._network_client = NetworkManagementClient(creds.credential, creds.subscription_id)

    def create_resource_group(self, name: str) -> str:
        rg = self._resource_client.resource_groups.create_or_update(name, {"location": self._location})
        self._network_client.virtual_networks.begin_create_or_update(
            name,
            f"{name}-vnet",
            {"location": self._location, "address_space": {"address_prefixes": [_VNET_ADDRESS_SPACE]}},
        ).result()
        return rg.id

    def delete_resource_group(self, external_id: str) -> None:
        self._resource_client.resource_groups.begin_delete(_resource_group_name_from_id(external_id)).result()

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

    def create_nsg(self, resource_group_external_id: str, name: str) -> str:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        nsg = self._network_client.network_security_groups.begin_create_or_update(
            rg_name, name, {"location": self._location}
        ).result()
        return nsg.id

    def delete_nsg(self, external_id: str) -> None:
        rg_name = _resource_group_name_from_id(external_id)
        self._network_client.network_security_groups.begin_delete(rg_name, _last_segment(external_id)).result()

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


class AzureDeploymentProvider(DeploymentProvider):
    """Deploys a service as an Azure IaaS VM into the given resource group. Optionally attaches an NSG to the VM's NIC."""

    def __init__(self, tenant: Tenant):
        creds = AzureCredentials(tenant)
        self._location = creds.location
        self._subnet_id = creds.subnet_id
        self._tenant_id = tenant.azure_tenant_id
        self._network_client = NetworkManagementClient(creds.credential, creds.subscription_id)
        self._compute_client = ComputeManagementClient(creds.credential, creds.subscription_id)

    def create_deployment(self, resource_group_external_id: str, spec: DeploymentSpec) -> DeploymentResult:
        rg_name = _resource_group_name_from_id(resource_group_external_id)
        nic_name = f"{spec.name}-nic"

        nic = self._network_client.network_interfaces.begin_create_or_update(
            rg_name,
            nic_name,
            {
                "location": self._location,
                "ip_configurations": [{"name": f"{spec.name}-ipconfig", "subnet": {"id": self._subnet_id}}],
                "network_security_group": {"id": spec.nsg_external_id} if spec.nsg_external_id else None,
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
                "tags": {"managedBy": "polaris-prime-networking"},
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
