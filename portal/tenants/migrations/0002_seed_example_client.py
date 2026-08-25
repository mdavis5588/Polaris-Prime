from django.db import migrations


def seed_example_client(apps, schema_editor):
    """
    One example Client with two Tenants (mirrors the earlier Node version's
    "Acme Corp" / tenant-1 / tenant-2 fixture) so the tenant switcher and
    admin have something to show out of the box. The ad_group_id values are
    obvious placeholders — swap them for real Azure AD security group object
    ids via /admin/ before Graph-based access checks will actually work.
    """
    Client = apps.get_model("tenants", "Client")
    Tenant = apps.get_model("tenants", "Tenant")

    client = Client.objects.create(code="acme", name="Acme Corp")
    Tenant.objects.create(
        client=client,
        tenant_id="tenant-1",
        name="Acme Corp — Tenant 1",
        ad_group_id="00000000-0000-0000-0000-000000000001",
    )
    Tenant.objects.create(
        client=client,
        tenant_id="tenant-2",
        name="Acme Corp — Tenant 2",
        ad_group_id="00000000-0000-0000-0000-000000000002",
    )


def remove_example_client(apps, schema_editor):
    Client = apps.get_model("tenants", "Client")
    Client.objects.filter(code="acme").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_example_client, remove_example_client),
    ]
