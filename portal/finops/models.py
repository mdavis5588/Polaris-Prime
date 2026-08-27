from decimal import Decimal

from django.db import models


class OnPremRateCard(models.Model):
    """
    The current on-prem cost assumptions Orion (this app) multiplies
    against a server's vcpu/ram_gb/storage_gb — see
    networking.ServiceDeployment — to estimate its compute cost. On-prem
    has no billing API to read real numbers from the way Azure does, so
    these are hand-maintained (see the "Rates" page, finops/views.py:
    rate_card).

    Deliberately a single row: get_current() always returns/creates pk=1,
    so editing the rate card changes the assumption platform-wide from
    that point on. No historical rate versioning yet — a cost figure
    Orion shows always reflects *today's* rates, not whatever was in
    effect when a server was deployed.
    """

    vcpu_monthly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    ram_gb_monthly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0"), verbose_name="RAM (per GB) monthly rate"
    )
    storage_gb_monthly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0"), verbose_name="Storage (per GB) monthly rate"
    )
    managed_service_monthly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Flat monthly add-on applied to servers with ServiceDeployment.is_managed set.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "On-prem rate card"
        verbose_name_plural = "On-prem rate card"

    def __str__(self):
        return "On-prem rate card"

    @classmethod
    def get_current(cls) -> "OnPremRateCard":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def monthly_compute_cost(self, *, vcpu: int, ram_gb: int, storage_gb: int) -> Decimal:
        return self.vcpu_monthly_rate * vcpu + self.ram_gb_monthly_rate * ram_gb + self.storage_gb_monthly_rate * storage_gb
