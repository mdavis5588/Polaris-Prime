from django.db import models

from tenants.models import Tenant

# Every provisioned object below carries the same pending/active/failed/deleting
# lifecycle: a row is written as "pending" the moment a create is requested,
# then flipped to "active" (with external_id set) or "failed" (with error set)
# once the underlying provider call (NetBox or Azure) returns. This mirrors
# the earlier Node version's store.ts and keeps the UI able to show
# in-progress state without the request/response cycle blocking on the
# provider call.


class ProvisioningStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACTIVE = "active", "Active"
    FAILED = "failed", "Failed"
    DELETING = "deleting", "Deleting"


class Target(models.TextChoices):
    AZURE = "azure", "Azure"
    ONPREM = "onprem", "On-prem"


class ResourceGroup(models.Model):
    """
    A tenant's Resource Group — the same container concept Azure uses,
    mirrored on-prem as one VLAN (see Subnet below) so the portal presents
    an identical model regardless of where it's actually deployed.
    """

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="resource_groups")
    target = models.CharField(max_length=10, choices=Target.choices)
    name = models.SlugField(max_length=90)
    description = models.CharField(max_length=300, blank=True)

    status = models.CharField(max_length=10, choices=ProvisioningStatus.choices, default=ProvisioningStatus.PENDING)
    error = models.TextField(blank=True)
    # Azure: full ARM resource id of the resource group.
    # On-prem: "netbox:vlan=<id>" — see providers/onprem.py.
    external_id = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["tenant", "name"]
        unique_together = [("tenant", "name")]

    def __str__(self):
        return f"{self.tenant} / {self.name}"


class Subnet(models.Model):
    """
    A subnet carved out of a Resource Group's VNet (Azure) or VLAN
    (on-prem, via NetBox prefix allocation). A Resource Group can hold
    several — created on demand by the client, not just one auto-allocated
    at Resource Group creation time.
    """

    resource_group = models.ForeignKey(ResourceGroup, on_delete=models.CASCADE, related_name="subnets")
    name = models.SlugField(max_length=90)
    cidr = models.CharField(max_length=64, blank=True, help_text="Populated once provisioning succeeds.")

    status = models.CharField(max_length=10, choices=ProvisioningStatus.choices, default=ProvisioningStatus.PENDING)
    error = models.TextField(blank=True)
    # Azure: full ARM resource id of the subnet.
    # On-prem: "netbox:prefix=<id>" — see providers/onprem.py.
    external_id = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["resource_group", "name"]
        unique_together = [("resource_group", "name")]

    def __str__(self):
        return f"{self.resource_group} / {self.name}"


class NetworkSecurityGroup(models.Model):
    """An NSG (Azure real; on-prem mapped to a netbox-acls access list scoped to the RG's VLAN)."""

    resource_group = models.ForeignKey(ResourceGroup, on_delete=models.CASCADE, related_name="nsgs")
    name = models.SlugField(max_length=90)

    status = models.CharField(max_length=10, choices=ProvisioningStatus.choices, default=ProvisioningStatus.PENDING)
    error = models.TextField(blank=True)
    # Azure: full ARM resource id of the NSG.
    # On-prem: "netbox:acl=<id>" — see providers/onprem.py.
    external_id = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "NSG"
        ordering = ["resource_group", "name"]
        unique_together = [("resource_group", "name")]

    def __str__(self):
        return f"{self.resource_group} / {self.name}"


class NsgRule(models.Model):
    class Direction(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"

    class Access(models.TextChoices):
        ALLOW = "allow", "Allow"
        DENY = "deny", "Deny"

    class Protocol(models.TextChoices):
        TCP = "tcp", "TCP"
        UDP = "udp", "UDP"
        ANY = "*", "Any"

    nsg = models.ForeignKey(NetworkSecurityGroup, on_delete=models.CASCADE, related_name="rules")
    name = models.SlugField(max_length=90)
    priority = models.PositiveIntegerField(help_text="Lower numbers evaluate first, same as Azure NSG rules.")
    direction = models.CharField(max_length=10, choices=Direction.choices)
    access = models.CharField(max_length=10, choices=Access.choices)
    protocol = models.CharField(max_length=4, choices=Protocol.choices)
    source_address_prefix = models.CharField(max_length=120, default="*")
    source_port_range = models.CharField(max_length=60, default="*")
    destination_address_prefix = models.CharField(max_length=120, default="*")
    destination_port_range = models.CharField(max_length=60, default="*")

    status = models.CharField(max_length=10, choices=ProvisioningStatus.choices, default=ProvisioningStatus.PENDING)
    error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nsg", "priority"]
        unique_together = [("nsg", "name")]

    def __str__(self):
        return f"{self.nsg} / {self.name}"


class ServiceDeployment(models.Model):
    """
    A service deployed into a Resource Group — real, as an Azure IaaS VM,
    for target=azure; a stub for target=onprem pending an orchestrator API
    contract (mirrors the earlier Node version's onPremDeploymentProvider).
    """

    resource_group = models.ForeignKey(ResourceGroup, on_delete=models.CASCADE, related_name="deployments")
    nsg = models.ForeignKey(
        NetworkSecurityGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="deployments"
    )
    name = models.SlugField(max_length=90)
    vm_size = models.CharField(max_length=60, help_text="e.g. 'Standard_B2s'. Informational for Azure; on-prem has no VM size catalog to match against.")
    admin_username = models.CharField(max_length=60)

    # Structured specs, independent of vm_size, so Orion (finops) can cost
    # this server the same way regardless of target: multiply against the
    # on-prem rate table directly, or roll up into an Azure Cost
    # Management query keyed on the polaris:* tags set at creation time
    # (see providers/azure.py) — vm_size alone isn't queryable that way.
    vcpu = models.PositiveIntegerField(default=1)
    ram_gb = models.PositiveIntegerField(default=1)
    storage_gb = models.PositiveIntegerField(default=1)

    status = models.CharField(max_length=10, choices=ProvisioningStatus.choices, default=ProvisioningStatus.PENDING)
    error = models.TextField(blank=True)
    external_id = models.CharField(max_length=300, blank=True)
    console_url = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["resource_group", "name"]
        unique_together = [("resource_group", "name")]

    def __str__(self):
        return f"{self.resource_group} / {self.name}"
