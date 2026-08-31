"""
Fake stand-ins for AzureNetworkProvider/AzureDeploymentProvider, for
exercising the whole Networking (and, downstream, Orion) flow without a
real Azure service principal — useful while Entra ID app registration
access isn't available yet (creating a real service principal always
needs *some* Entra ID permission, so there's no way around that
requirement itself once you actually want real resources; this just
un-blocks everything else in the meantime).

Enabled via AZURE_MOCK_MODE=true in .env (see settings.py) — dispatched
in services.py alongside the real Azure/on-prem providers, never
touching real ARM/Network/Compute APIs. A Tenant still needs
azure_subscription_id set (any placeholder value) for has_azure to be
true and unlock the "Azure" target in the UI; azure_tenant_id/
azure_client_id/the client secret are never read in mock mode.
"""

import uuid

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

_NOT_CONFIGURED = (
    "Mock mode has nothing real behind it, so there's no way to tell "
    "what still exists — Sync/reconciliation isn't meaningful here and "
    "is skipped rather than marking everything gone."
)


def _fake_id(kind: str) -> str:
    return f"mock:{kind}:{uuid.uuid4().hex[:12]}"


class MockNetworkProvider(NetworkProvider):
    def create_resource_group(self, name: str) -> str:
        return _fake_id("rg")

    def delete_resource_group(self, external_id: str) -> None:
        pass

    def list_resource_groups(self) -> list[DiscoveredResourceGroup]:
        # Raises rather than returning [] — an empty list means "checked,
        # there are none," which would make reconcile_resource_groups
        # (services.py) mark every mock-created resource group GONE the
        # moment someone clicks Sync. There's nothing real to check
        # against here at all, which is a different thing.
        raise ProviderNotConfigured(_NOT_CONFIGURED)

    def create_subnet(self, resource_group_external_id: str, name: str) -> SubnetResult:
        return SubnetResult(external_id=_fake_id("subnet"), cidr="10.99.0.0/24")

    def delete_subnet(self, resource_group_external_id: str, external_id: str) -> None:
        pass

    def list_subnets(self, resource_group_external_id: str) -> list[DiscoveredSubnet]:
        raise ProviderNotConfigured(_NOT_CONFIGURED)

    def create_nsg(self, resource_group_external_id: str, name: str) -> str:
        return _fake_id("nsg")

    def delete_nsg(self, external_id: str) -> None:
        pass

    def list_nsgs(self, resource_group_external_id: str) -> list[DiscoveredNsg]:
        raise ProviderNotConfigured(_NOT_CONFIGURED)

    def add_rule(self, nsg_external_id: str, rule: RuleSpec) -> None:
        pass

    def remove_rule(self, nsg_external_id: str, rule_name: str) -> None:
        pass

    def list_rules(self, nsg_external_id: str) -> list[RuleSpec]:
        raise ProviderNotConfigured(_NOT_CONFIGURED)


class MockDeploymentProvider(DeploymentProvider):
    def create_deployment(self, resource_group_external_id: str, spec: DeploymentSpec) -> DeploymentResult:
        return DeploymentResult(external_id=_fake_id("vm"), console_url="https://portal.azure.com/#mock-deployment")

    def delete_deployment(self, resource_group_external_id: str, external_id: str) -> None:
        pass

    def list_deployments(self, resource_group_external_id: str) -> list[DiscoveredDeployment]:
        raise ProviderNotConfigured(_NOT_CONFIGURED)
