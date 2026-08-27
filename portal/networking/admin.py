from django.contrib import admin

from .models import NetworkSecurityGroup, NsgRule, ResourceGroup, ServiceDeployment, Subnet


class SubnetInline(admin.TabularInline):
    model = Subnet
    extra = 0
    fields = ("name", "cidr", "status", "external_id")
    readonly_fields = ("status", "external_id")


class NsgInline(admin.TabularInline):
    model = NetworkSecurityGroup
    extra = 0
    fields = ("name", "status", "external_id")
    readonly_fields = ("status", "external_id")


class DeploymentInline(admin.TabularInline):
    model = ServiceDeployment
    extra = 0
    fields = ("name", "vm_size", "status", "external_id", "console_url")
    readonly_fields = ("status", "external_id", "console_url")


@admin.register(ResourceGroup)
class ResourceGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "target", "status", "created_at")
    list_filter = ("target", "status", "tenant")
    search_fields = ("name", "tenant__name")
    readonly_fields = ("status", "error", "external_id", "created_at")
    inlines = [SubnetInline, NsgInline, DeploymentInline]


class NsgRuleInline(admin.TabularInline):
    model = NsgRule
    extra = 0
    fields = ("priority", "name", "direction", "access", "protocol", "source_address_prefix", "destination_address_prefix", "destination_port_range", "status")
    readonly_fields = ("status",)


@admin.register(NetworkSecurityGroup)
class NetworkSecurityGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "resource_group", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "resource_group__name")
    readonly_fields = ("status", "error", "external_id", "created_at")
    inlines = [NsgRuleInline]


@admin.register(Subnet)
class SubnetAdmin(admin.ModelAdmin):
    list_display = ("name", "resource_group", "cidr", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "resource_group__name")
    readonly_fields = ("status", "error", "external_id", "created_at")


@admin.register(ServiceDeployment)
class ServiceDeploymentAdmin(admin.ModelAdmin):
    list_display = ("name", "resource_group", "vm_size", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "resource_group__name")
    readonly_fields = ("status", "error", "external_id", "console_url", "created_at")
