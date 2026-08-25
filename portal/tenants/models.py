import os

from django.db import models


class Client(models.Model):
    """An organization Polaris manages tenants for."""

    code = models.SlugField(unique=True)
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Tenant(models.Model):
    """
    A login-scoped, AD-group-gated tenant — a tracking/cost-attribution
    boundary a client's resource groups get created under, not tied to
    any one cloud account. Membership in ad_group_id is what grants a
    signed-in user access to this tenant; checked live via Microsoft
    Graph (see graph.py), never cached indefinitely.

    Deliberately NOT storing azure_client_secret here — everything else
    about a tenant is fine to manage through /admin/, but a secret
    sitting in plaintext in the database is a real downgrade from the
    env-var-only approach used everywhere else in this project. See
    get_azure_client_secret() below.
    """

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="tenants")
    tenant_id = models.SlugField(help_text="Unique within the client, e.g. 'tenant-1'.")
    name = models.CharField(max_length=200, help_text="Shown in the tenant switcher.")
    ad_group_id = models.CharField(
        max_length=64,
        unique=True,
        help_text="Azure AD security group object id. Membership grants access to this tenant.",
    )

    # On-prem — networking (Resource Groups/NSGs via NetBox) and eventual
    # service deployment via the orchestrator, once it exists.
    resource_pool_id = models.CharField(max_length=200, blank=True)
    orchestrator_url = models.URLField(blank=True)
    netbox_site_id = models.IntegerField(
        null=True, blank=True, help_text="NetBox site id this tenant's VLANs are scoped to."
    )

    # Azure — real Resource Group/NSG/VM provisioning via a service principal.
    azure_subscription_id = models.CharField(max_length=64, blank=True)
    azure_tenant_id = models.CharField(max_length=64, blank=True)
    azure_client_id = models.CharField(max_length=64, blank=True)
    azure_location = models.CharField(max_length=50, blank=True, help_text="e.g. 'eastus'.")
    azure_subnet_id = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["client__name", "name"]
        unique_together = [("client", "tenant_id")]

    def __str__(self):
        return f"{self.client.name} — {self.name}"

    @property
    def has_onprem(self) -> bool:
        return bool(self.resource_pool_id)

    @property
    def has_azure(self) -> bool:
        return bool(self.azure_subscription_id)

    def get_azure_client_secret(self) -> str | None:
        """
        Reads TENANT_<TENANT_ID>_AZURE_CLIENT_SECRET from the environment
        (tenant_id upper-cased, hyphens to underscores), e.g. tenant_id
        'tenant-1' -> TENANT_TENANT_1_AZURE_CLIENT_SECRET. Never stored
        in the database.
        """
        env_name = f"TENANT_{self.tenant_id.upper().replace('-', '_')}_AZURE_CLIENT_SECRET"
        return os.environ.get(env_name)
