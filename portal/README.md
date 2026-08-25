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
- **tenants** — not yet built. Will port the Backstage version's
  AD-group-gated tenant model: real Azure AD sign-in (already wired,
  see `accounts/`) plus live Microsoft Graph group-membership checks to
  determine which tenants a signed-in user can act as.
- **networking** — not yet built. Will port Resource Groups / NSGs /
  service deployments — real for Azure, NetBox-backed for on-prem VLANs
  and access lists, same model as the Backstage version.
- **dashboard**, **finops** — placeholder pages, intentionally not built
  out yet.
- **accounts** — Microsoft sign-in wiring (django-allauth configuration
  and adapter). No dedicated views of its own.

## What's real right now vs. what's a placeholder

Real: the whole skeleton (auth wiring, routing, base template/nav,
Postgres persistence) and the catalog app, verified end-to-end against a
real Postgres database. Placeholder: tenants, networking, dashboard, and
finops all render but don't do anything yet — they're next.
