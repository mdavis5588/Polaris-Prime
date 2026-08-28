"""
Canonical Resource Group / Subnet / NSG / deployment operations the portal
exposes the same way regardless of deployment target — the Azure provider
(azure.py) maps these onto real ARM/Network/Compute resources, and the
on-prem provider (onprem.py) maps them onto NetBox VLANs/prefixes and the
netbox-acls plugin. Ported from the earlier Node version's
providers/types.ts + deploymentTypes.ts.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RuleSpec:
    name: str
    priority: int
    direction: str  # "inbound" | "outbound"
    access: str  # "allow" | "deny"
    protocol: str  # "tcp" | "udp" | "*"
    source_address_prefix: str
    source_port_range: str
    destination_address_prefix: str
    destination_port_range: str


@dataclass
class SubnetResult:
    external_id: str
    cidr: str


@dataclass
class DiscoveredResourceGroup:
    external_id: str
    name: str


@dataclass
class DeploymentSpec:
    name: str
    vm_size: str
    admin_username: str
    admin_password: str
    nsg_external_id: str | None = None


@dataclass
class DeploymentResult:
    external_id: str
    console_url: str


class ProviderNotConfigured(RuntimeError):
    """Raised when a provider is invoked before its required settings/credentials are present."""


class NetworkProvider(ABC):
    @abstractmethod
    def create_resource_group(self, name: str) -> str:
        """Returns the new resource group's external_id."""

    @abstractmethod
    def delete_resource_group(self, external_id: str) -> None: ...

    @abstractmethod
    def list_resource_groups(self) -> list[DiscoveredResourceGroup]:
        """
        Every resource group this provider's credential can see — for
        Azure, whatever the tenant's service principal has RBAC access to
        in the shared subscription (not filtered by tag or anything else
        Polaris controls: access is the scoping mechanism, by design — see
        networking/services.py: discover_resource_groups). For on-prem,
        every VLAN in the configured NetBox group/site.
        """

    @abstractmethod
    def create_subnet(self, resource_group_external_id: str, name: str) -> SubnetResult: ...

    @abstractmethod
    def delete_subnet(self, resource_group_external_id: str, external_id: str) -> None: ...

    @abstractmethod
    def create_nsg(self, resource_group_external_id: str, name: str) -> str:
        """Returns the new NSG's external_id."""

    @abstractmethod
    def delete_nsg(self, external_id: str) -> None: ...

    @abstractmethod
    def add_rule(self, nsg_external_id: str, rule: RuleSpec) -> None: ...

    @abstractmethod
    def remove_rule(self, nsg_external_id: str, rule_name: str) -> None: ...


class DeploymentProvider(ABC):
    @abstractmethod
    def create_deployment(self, resource_group_external_id: str, spec: DeploymentSpec) -> DeploymentResult: ...

    @abstractmethod
    def delete_deployment(self, resource_group_external_id: str, external_id: str) -> None: ...
