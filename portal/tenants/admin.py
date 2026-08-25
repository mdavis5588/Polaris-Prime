from django.contrib import admin

from .models import Client, Tenant


class TenantInline(admin.TabularInline):
    model = Tenant
    extra = 0
    fields = ("tenant_id", "name", "ad_group_id", "resource_pool_id", "azure_subscription_id")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "code")
    search_fields = ("name", "code")
    inlines = [TenantInline]


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "client", "tenant_id", "has_onprem", "has_azure")
    list_filter = ("client",)
    search_fields = ("name", "tenant_id", "ad_group_id")
    fieldsets = (
        (None, {"fields": ("client", "tenant_id", "name", "ad_group_id")}),
        (
            "On-prem (NetBox networking)",
            {"fields": ("resource_pool_id", "orchestrator_url", "netbox_site_id")},
        ),
        (
            "Azure (service principal secret is NOT stored here — set "
            "TENANT_<TENANT_ID>_AZURE_CLIENT_SECRET in the environment instead)",
            {
                "fields": (
                    "azure_subscription_id",
                    "azure_tenant_id",
                    "azure_client_id",
                    "azure_location",
                    "azure_subnet_id",
                )
            },
        ),
    )
