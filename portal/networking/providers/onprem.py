"""
On-prem networking: one VLAN per Resource Group (NetBox core IPAM), with
subnets carved from a shared parent prefix and attached to that VLAN on
demand — a Resource Group can hold several, created explicitly by the
client rather than one auto-allocated at Resource Group creation time (a
deliberate extension over the earlier Node version, which allocated a
single prefix alongside the VLAN). NSGs map to netbox-acls access lists
scoped to the VLAN — see netbox.py for the plugin-stability caveat.

This covers networking only. NetBox is IPAM/DCIM, not a hypervisor or
compute orchestrator, so actually deploying a service onto this VLAN is a
separate concern — see deployment.py, still a stub pending an
orchestrator API contract. Applying these VLANs/ACLs to real switches is
also a separate step (a NetBox webhook triggering an Ansible/Nornir job,
typically) — NetBox itself only holds the desired state.
"""

import re

from .base import DeploymentProvider, DeploymentResult, DeploymentSpec, DiscoveredResourceGroup, NetworkProvider, ProviderNotConfigured, RuleSpec, SubnetResult
from .netbox import NetBoxClient, read_netbox_settings

_RG_ID_RE = re.compile(r"^netbox:vlan=(\d+)$")
_SUBNET_ID_RE = re.compile(r"^netbox:prefix=(\d+)$")
_NSG_ID_RE = re.compile(r"^netbox:acl=(\d+)$")


def _encode_rg_id(vlan_id: int) -> str:
    return f"netbox:vlan={vlan_id}"


def _decode_rg_id(external_id: str) -> int:
    match = _RG_ID_RE.match(external_id)
    if not match:
        raise ValueError(f"Not a NetBox resource group id: {external_id}")
    return int(match.group(1))


def _encode_subnet_id(prefix_id: int) -> str:
    return f"netbox:prefix={prefix_id}"


def _decode_subnet_id(external_id: str) -> int:
    match = _SUBNET_ID_RE.match(external_id)
    if not match:
        raise ValueError(f"Not a NetBox prefix id: {external_id}")
    return int(match.group(1))


def _encode_nsg_id(access_list_id: int) -> str:
    return f"netbox:acl={access_list_id}"


def _decode_nsg_id(external_id: str) -> int:
    match = _NSG_ID_RE.match(external_id)
    if not match:
        raise ValueError(f"Not a NetBox access list id: {external_id}")
    return int(match.group(1))


class OnPremNetworkProvider(NetworkProvider):
    def __init__(self, site_id: int | None):
        self._client = NetBoxClient(read_netbox_settings())
        self._site_id = site_id

    def create_resource_group(self, name: str) -> str:
        vlan = self._client.create_vlan(f"rg-{name}", self._site_id)
        return _encode_rg_id(vlan["id"])

    def delete_resource_group(self, external_id: str) -> None:
        self._client.delete_vlan(_decode_rg_id(external_id))

    def list_resource_groups(self) -> list[DiscoveredResourceGroup]:
        return [
            DiscoveredResourceGroup(external_id=_encode_rg_id(vlan["id"]), name=vlan["name"])
            for vlan in self._client.list_vlans(self._site_id)
        ]

    def create_subnet(self, resource_group_external_id: str, name: str) -> SubnetResult:
        vlan_id = _decode_rg_id(resource_group_external_id)
        prefix = self._client.allocate_prefix_for_vlan(vlan_id)
        return SubnetResult(external_id=_encode_subnet_id(prefix["id"]), cidr=prefix["prefix"])

    def delete_subnet(self, resource_group_external_id: str, external_id: str) -> None:
        self._client.delete_prefix(_decode_subnet_id(external_id))

    def create_nsg(self, resource_group_external_id: str, name: str) -> str:
        vlan_id = _decode_rg_id(resource_group_external_id)
        acl = self._client.create_access_list(name, vlan_id)
        return _encode_nsg_id(acl["id"])

    def delete_nsg(self, external_id: str) -> None:
        self._client.delete_access_list(_decode_nsg_id(external_id))

    def add_rule(self, nsg_external_id: str, rule: RuleSpec) -> None:
        self._client.create_access_list_rule(_decode_nsg_id(nsg_external_id), rule)

    def remove_rule(self, nsg_external_id: str, rule_name: str) -> None:
        self._client.delete_access_list_rule_by_name(_decode_nsg_id(nsg_external_id), rule_name)


class OnPremDeploymentProvider(DeploymentProvider):
    """Stub pending an orchestrator API contract — on-prem is IPAM/DCIM-only via NetBox, with no hypervisor/compute orchestrator wired up yet."""

    _NOT_CONFIGURED = (
        "On-prem service deployment isn't available yet — it needs a compute "
        "orchestrator API to actually create a VM/container on the resource "
        "pool, which hasn't been wired up. Networking (VLANs/subnets/NSGs) "
        "works today; deployment onto them doesn't."
    )

    def create_deployment(self, resource_group_external_id: str, spec: DeploymentSpec) -> DeploymentResult:
        raise ProviderNotConfigured(self._NOT_CONFIGURED)

    def delete_deployment(self, resource_group_external_id: str, external_id: str) -> None:
        raise ProviderNotConfigured(self._NOT_CONFIGURED)
