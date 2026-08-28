# Polaris Prime Portal

A purpose-built replacement for the earlier Backstage-based Polaris Prime
(still at the repo root, untouched, on `claude/optimistic-rubin-jpiq7b`) —
Django + PostgreSQL + htmx instead of a plugin-framework-shaped app, since
most of what Polaris Prime actually needed (a catalog, tenant/AD-group
auth, infra management) had already outgrown Backstage's own abstractions
by the time this branch started.

## Stack

- **Django** (templates + [htmx](https://htmx.org), vendored locally at
  `static/js/htmx.min.js` — no SPA/JS build step)
- **PostgreSQL** — real, from day one; no ephemeral in-memory database
  (the earlier Backstage version's SQLite `:memory:` config caused a
  real outage-shaped bug when it wiped auth signing keys on every
  restart — not repeating that here)
- **django-allauth** for Microsoft (Entra ID / Azure AD) sign-in — no
  guest/anonymous fallback, since tenant access is gated by real AD
  group membership

## Getting started

```sh
cd portal
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # then fill in whatever you need — see below

# Local Postgres — either docker compose, or point POSTGRES_* in .env
# at an existing instance:
docker compose up -d db

python3 manage.py migrate
python3 manage.py createsuperuser
python3 manage.py runserver
```

Nothing in `.env.example` is required just to run the app locally —
Dashboard, Catalog, Networking, and FinOps all load, and Django's own
admin (`/admin/`) works with a superuser account, without any Azure AD
config. Sign-in with Microsoft simply doesn't offer itself as an option
until `AZURE_AD_CLIENT_ID`/`AZURE_AD_CLIENT_SECRET`/`AZURE_AD_TENANT_ID`
are all set — same "commented out until configured" philosophy as the
Backstage version's `.env.example`.

## Apps

- **catalog** — services/APIs/templates, searchable (htmx live search).
  Ships with one seeded entry, "Database as a Service" — the previous
  Backstage version's DBaaS wizard isn't being rebuilt here; it's
  referenced from the catalog as a placeholder instead (see the seed
  migration, `catalog/migrations/0002_seed_dbaas_entry.py`).
- **tenants** — ported. `Client`/`Tenant` models, managed via `/admin/`;
  a live Microsoft Graph app-only check (`tenants/graph.py`, 60s cache,
  `tenants/services.py`) determines which tenants a signed-in user's AD
  group memberships actually grant access to; a context processor
  (`tenants/context_processors.py`) injects `my_tenants`/`current_tenant`
  into every template so the sidebar's tenant switcher just works. Which
  tenant you're "in" is tracked server-side in the session (`tenants/
  views.py`, `switch_tenant`) — a deliberate improvement over the earlier
  Node version's client-side/localStorage approach. Per-tenant Azure
  service principal secrets are never stored in the database — see
  `Tenant.get_azure_client_secret()` and `.env.example`. Ships with one
  seeded example `Client`("Acme Corp") and two `Tenant`s with placeholder
  `ad_group_id` values — replace them with real Azure AD security group
  object ids via `/admin/` before Graph-based access checks do anything
  useful.
- **networking** — ported. Resource Groups, Subnets, NSGs/rules, and
  service deployments, scoped to whichever tenant the sidebar switcher
  has selected. A Resource Group is one VLAN on-prem (via NetBox core
  IPAM) or one VNet in Azure, with Subnets carved out of it on demand —
  a client can create several, rather than getting one auto-allocated
  at Resource Group creation time. NSGs map to real Azure NSGs or, on-prem, to access
  lists from the community netbox-acls plugin, scoped to the RG's VLAN. Service deployments are real Azure IaaS VMs; on-prem
  deployment is a deliberate stub (`networking/providers/onprem.py`,
  `OnPremDeploymentProvider`) pending an orchestrator API contract — NetBox
  is IPAM/DCIM, not a hypervisor. `networking/providers/base.py` defines
  the canonical `NetworkProvider`/`DeploymentProvider` interface both
  targets implement; `networking/services.py` dispatches to the right one
  per tenant+target and persists pending/active/failed status on every
  create. See `.env.example` for the `NETBOX_*` settings on-prem
  provisioning needs, and the tenants app entry above for per-tenant
  Azure credentials.

  Polaris's own Postgres database is the only source of truth for which
  tenant a Resource Group (or Subnet, NSG, rule, deployment) belongs to
  — nothing about that tie is read from Azure or NetBox, so a resource
  created outside Polaris (directly in the Azure Portal, or by hand in
  NetBox) is invisible to it by default, and a resource *deleted*
  outside Polaris stays listed as if nothing happened. The "Sync"
  buttons on the Networking page (`resource_group_sync` in `views.py`,
  `reconcile_resource_groups` in `services.py`) close both gaps at
  once, recursively: for every resource group (imported or already
  tracked), it also asks the provider for that RG's subnets, NSGs,
  rules, and deployments — importing anything new, and marking anything
  Polaris tracks as `ProvisioningStatus.GONE` (a new status; see
  `models.py`) if the provider no longer reports it. GONE is never a
  hard delete — the row stays as an audit trail and is excluded from
  Orion's cost totals, but only disappears from Postgres if someone
  deletes it by hand (which, for a GONE row, just removes the Postgres
  record — there's nothing left to ask the provider to delete). When an
  RG itself goes GONE, its still-active children are cascaded to GONE
  in the same pass rather than left pointing at a parent that no longer
  exists. On-prem deployments are the one exception: `OnPremDeploymentProvider`
  has no orchestrator to enumerate against, so its `list_deployments`
  raises `ProviderNotConfigured` — reconciliation catches that
  specifically and leaves on-prem deployment rows untouched, rather
  than treating "can't check" the same as "there are none."

  Deliberately *not* tag-based: with every tenant's resource groups
  living in one shared Azure subscription (see `tenants` above), the
  thing that has to scope results to the right tenant is the tenant's
  own service principal's Azure RBAC role assignments (only Reader/
  Contributor on its own resource groups, not the whole subscription) —
  a subscription-wide credential would see every tenant's resource
  groups here, tag or no tag. On-prem is scoped the equivalent way, via
  `Tenant.netbox_site_id` rather than RBAC.

  For finops (Orion) purposes, cost attribution down to tenant → resource
  group → server doesn't need a separate tagging system — it's already a
  real FK chain (`ServiceDeployment.resource_group.tenant`). What *is*
  tagging: every top-level Azure resource this provider creates gets
  stamped with `polaris:tenant` / `polaris:resource_group` /
  `polaris:deployment` tags (`providers/azure.py`, `_polaris_tags()`), so
  Azure Cost Management's own tag-based cost queries line up with that
  same hierarchy. On-prem has no cost API to tag into, so `ServiceDeployment`
  carries structured `vcpu`/`ram_gb`/`storage_gb` fields instead — Orion
  multiplies those against an on-prem rate table directly.
- **finops (Orion)** — ported. Combined cost visibility per tenant,
  rolled up from real relations rather than a tagging system: `Tenant`
  → `ResourceGroup` → `ServiceDeployment` is a real FK chain, so
  `finops/services.py` just sums a per-server `CostBreakdown` (compute +
  managed service + licensing) up that tree — `get_deployment_cost`,
  `get_resource_group_cost`, `get_tenant_cost`. A server's compute cost
  is either real Azure spend (`finops/providers.py`, `AzureCostClient`,
  scoped by the `polaris:*` tags described above) or, on-prem, the rate
  card (`OnPremRateCard`) multiplied against that server's own
  `vcpu`/`ram_gb`/`storage_gb`. Managed-service cost is the rate card's
  flat monthly add-on, applied only to servers with
  `ServiceDeployment.is_managed` set. Licensing cost comes from Helios
  (`HeliosClient`). Both `AzureCostClient` and `HeliosClient` are
  deliberate mocks returning $0 until real credentials/API docs are
  available — nothing else needs to change once they are, since
  `get_deployment_cost` is the only caller. The on-prem rate card is
  editable at `/finops/rates/` (the "page to input potential costs") or
  via `/admin/`; the dashboard at `/finops/` shows the current tenant's
  total and a per-resource-group breakdown, drilling into
  `/finops/resource-groups/<id>/` for the per-server breakdown.
- **dashboard** — placeholder page, intentionally not built out yet.
- **accounts** — Microsoft sign-in wiring (django-allauth configuration
  and adapter). No dedicated views of its own.

## What's real right now vs. what's a placeholder

Real: the whole skeleton (auth wiring, routing, base template/nav,
Postgres persistence), the catalog app, the tenants app, the networking
app, and the finops (Orion) app, all verified end-to-end against a real
Postgres database (networking's Azure/NetBox provider calls, and
finops's Azure Cost Management / Helios lookups, were verified against
mocked HTTP/SDK boundaries — this sandbox has no real Azure
subscription, NetBox instance, or Helios instance to call). Placeholder:
dashboard renders but doesn't do anything yet. On-prem service
deployment is a deliberate stub within the otherwise-real networking app
— see the networking entry
above.
