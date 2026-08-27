from django.contrib import admin

from .models import OnPremRateCard


@admin.register(OnPremRateCard)
class OnPremRateCardAdmin(admin.ModelAdmin):
    list_display = ("vcpu_monthly_rate", "ram_gb_monthly_rate", "storage_gb_monthly_rate", "managed_service_monthly_rate", "updated_at")
    readonly_fields = ("updated_at",)

    def has_add_permission(self, request):
        # Single row (see OnPremRateCard.get_current) — /finops/rates/ is the
        # normal way to edit it, this is just a fallback for admins without
        # a Microsoft account linked (see accounts/adapter.py).
        return not OnPremRateCard.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
