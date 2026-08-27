"""
Pluggable cost data sources — Helios (owned-license costs) and Azure Cost
Management (real cloud compute/managed-service spend). Neither has real
credentials/an endpoint wired up yet, so both return zero rather than
raising: Orion's totals stay usable (just under-counting whatever a
source isn't configured for) instead of the dashboard breaking the moment
one integration isn't ready. Swapping in a real implementation later is a
matter of rewriting the method bodies below — get_deployment_cost's
callers (finops/services.py) don't need to change.
"""

from decimal import Decimal


class HeliosClient:
    """
    Owned-license cost lookups, per server. Real integration needs a
    Helios base URL/API key (not yet in settings.py/.env.example — add
    them alongside AZURE_AD_* once Helios API docs are available) and a
    way to match a Polaris ServiceDeployment to a Helios-tracked license
    — most likely by hostname/deployment name, since that's the only
    identifier both systems would share.
    """

    def get_license_cost(self, deployment) -> Decimal:
        return Decimal("0")


class AzureCostClient:
    """
    Real spend from Azure Cost Management, scoped by the polaris:tenant /
    polaris:resource_group / polaris:deployment tags every Azure resource
    is created with (see networking/providers/azure.py). Real integration
    needs the Cost Management Reader role on the tenant's subscription and
    the Cost Management Query API (a tenant-scoped ClientSecretCredential,
    same as networking's own Azure provider already builds).
    """

    def get_deployment_cost(self, deployment) -> Decimal:
        return Decimal("0")

    def get_resource_group_cost(self, resource_group) -> Decimal:
        """
        Costs Cost Management attributes to the resource group as a whole
        rather than any one server Polaris tracks (e.g. a storage account
        or load balancer created outside Polaris's own inventory). Not
        currently added into get_resource_group_cost's total in
        services.py — Polaris only tracks VM deployments today — but the
        query is scoped and ready for whenever that inventory grows.
        """
        return Decimal("0")
