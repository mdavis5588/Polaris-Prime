from django.contrib import admin

from .models import Entry


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "owner", "updated_at")
    list_filter = ("kind",)
    search_fields = ("name", "description", "owner", "tags")
