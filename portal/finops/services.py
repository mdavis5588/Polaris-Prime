"""
Cost aggregation: server -> resource group -> tenant. The containment
itself needs no tagging system to compute — ServiceDeployment.resource_group
and ResourceGroup.tenant are real foreign keys — so this module is just
the per-server cost lookup (get_deployment_cost) plus two sums on top of
it.
"""

from dataclasses import dataclass
from decimal import Decimal

from networking.models import ResourceGroup, ServiceDeployment
from tenants.models import Tenant

from .models import OnPremRateCard
from .providers import AzureCostClient, HeliosClient

_helios = HeliosClient()
_azure_cost = AzureCostClient()


@dataclass
class CostBreakdown:
    compute: Decimal
    managed_service: Decimal
    license: Decimal

    @property
    def total(self) -> Decimal:
        return self.compute + self.managed_service + self.license

    def __add__(self, other: "CostBreakdown") -> "CostBreakdown":
        return CostBreakdown(
            compute=self.compute + other.compute,
            managed_service=self.managed_service + other.managed_service,
            license=self.license + other.license,
        )


ZERO_COST = CostBreakdown(Decimal("0"), Decimal("0"), Decimal("0"))


def sum_costs(costs) -> CostBreakdown:
    total = ZERO_COST
    for cost in costs:
        total = total + cost
    return total


def get_deployment_cost(deployment: ServiceDeployment) -> CostBreakdown:
    if deployment.resource_group.target == "azure":
        compute = _azure_cost.get_deployment_cost(deployment)
        # Azure managed-service spend isn't a separate line item the way
        # the on-prem rate card treats it — once Polaris has a real
        # managed-services product on Azure, it reads from Cost
        # Management the same way compute does, rather than a flat rate.
        managed_service = Decimal("0")
    else:
        rate_card = OnPremRateCard.get_current()
        compute = rate_card.monthly_compute_cost(vcpu=deployment.vcpu, ram_gb=deployment.ram_gb, storage_gb=deployment.storage_gb)
        managed_service = rate_card.managed_service_monthly_rate if deployment.is_managed else Decimal("0")

    return CostBreakdown(compute=compute, managed_service=managed_service, license=_helios.get_license_cost(deployment))


def get_resource_group_cost(resource_group: ResourceGroup) -> CostBreakdown:
    # A GONE resource group (see networking/services.py: reconcile_resource_groups)
    # doesn't exist for real any more — kept in Postgres as an audit
    # trail, but never billed. Its deployments are cascaded to GONE in
    # the same reconciliation pass, so excluding GONE deployments here
    # too is belt-and-suspenders for the rare row that goes stale outside
    # a full reconcile.
    if resource_group.status == "gone":
        return ZERO_COST
    return sum_costs(get_deployment_cost(d) for d in resource_group.deployments.exclude(status="gone"))


def get_tenant_cost(tenant: Tenant) -> CostBreakdown:
    return sum_costs(get_resource_group_cost(rg) for rg in tenant.resource_groups.all())
