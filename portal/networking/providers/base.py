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
class DiscoveredSubnet:
    external_id: str
    name: str
    cidr: str


@dataclass
class DiscoveredNsg:
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


@dataclass
class DiscoveredDeployment:
    external_id: str
    name: str
    vm_size: str
    admin_username: str
    vcpu: int
    ram_gb: int
    storage_gb: int
    console_url: str
    nsg_external_id: str | None = None


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
        networking/services.py: reconcile_resource_groups). For on-prem,
        every VLAN in the configured NetBox group/site.

        May raise ProviderNotConfigured instead, for a provider with no
        way to enumerate real state at all (mock.py) — distinct from
        returning an empty list, which means "checked, there are none."
        reconcile_resource_groups treats a raise as "nothing to compare,
        skip reconciliation" rather than marking every tracked resource
        group GONE.
        """

    @abstractmethod
    def create_subnet(self, resource_group_external_id: str, name: str) -> SubnetResult: ...

    @abstractmethod
    def delete_subnet(self, resource_group_external_id: str, external_id: str) -> None: ...

    @abstractmethod
    def list_subnets(self, resource_group_external_id: str) -> list[DiscoveredSubnet]: ...

    @abstractmethod
    def create_nsg(self, resource_group_external_id: str, name: str) -> str:
        """Returns the new NSG's external_id."""

    @abstractmethod
    def delete_nsg(self, external_id: str) -> None: ...

    @abstractmethod
    def list_nsgs(self, resource_group_external_id: str) -> list[DiscoveredNsg]: ...

    @abstractmethod
    def add_rule(self, nsg_external_id: str, rule: RuleSpec) -> None: ...

    @abstractmethod
    def remove_rule(self, nsg_external_id: str, rule_name: str) -> None: ...

    @abstractmethod
    def list_rules(self, nsg_external_id: str) -> list[RuleSpec]: ...


class DeploymentProvider(ABC):
    @abstractmethod
    def create_deployment(self, resource_group_external_id: str, spec: DeploymentSpec) -> DeploymentResult: ...

    @abstractmethod
    def delete_deployment(self, resource_group_external_id: str, external_id: str) -> None: ...

    @abstractmethod
    def list_deployments(self, resource_group_external_id: str) -> list[DiscoveredDeployment]:
        """
        Raises ProviderNotConfigured if this target has no way to
        enumerate deployments at all (on-prem: no orchestrator exists yet
        — see onprem.py) — distinct from returning an empty list, which
        means "asked, and there are genuinely none." Reconciliation
        (services.py) treats the two very differently: an empty list
        marks every currently-tracked deployment GONE; a raised
        ProviderNotConfigured leaves them untouched, since there'd be no
        way to know whether they're still real.
        """
