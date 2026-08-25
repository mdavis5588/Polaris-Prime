from django.db import migrations


def seed_dbaas_entry(apps, schema_editor):
    Entry = apps.get_model("catalog", "Entry")
    Entry.objects.get_or_create(
        name="Database as a Service",
        defaults=dict(
            kind="template",
            description=(
                "Self-service Oracle, SQL Server, MongoDB, and PostgreSQL "
                "provisioning on-premises, on OCI, or on Azure. Not yet "
                "rebuilt on this portal — the previous Backstage-based "
                "wizard covered Oracle provisioning end-to-end with a "
                "live cost comparison; this catalog entry is a placeholder "
                "reference until it's ported."
            ),
            owner="platform-team",
            tags="database, oracle, postgresql, sql-server, mongodb",
        ),
    )


def remove_dbaas_entry(apps, schema_editor):
    Entry = apps.get_model("catalog", "Entry")
    Entry.objects.filter(name="Database as a Service").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_dbaas_entry, remove_dbaas_entry),
    ]
