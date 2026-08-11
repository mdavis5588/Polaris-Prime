# Polaris Prime

Polaris Prime is an internal developer platform built on
[Backstage](https://backstage.io), providing a self-service software
catalog and Database as a Service (DBaaS) template for provisioning Oracle,
SQL Server, MongoDB, and PostgreSQL databases on-premises, on Oracle Cloud
Infrastructure (OCI), or on Microsoft Azure.

## Getting started

```sh
cp .env.example .env   # then uncomment + fill in whichever values you need — see below
yarn install
yarn start
```

This starts the frontend (`localhost:3000`) and backend (`localhost:7007`)
together. `yarn start` automatically loads `.env` (via `dotenv-cli`) before
starting, so anything you set there is picked up without exporting it
yourself. `.env` is gitignored — `.env.example` documents every variable
the config files reference and is the one that's committed.

**Important**: everything in `.env.example` is commented out by default —
keep it that way for anything you're not using. A variable that's *set to
an empty string* (`GITHUB_TOKEN=`) is not the same as unset to Backstage:
an empty string fails config validation for required fields and can take
the whole backend down (this happened once — see git history if curious).
A commented-out (truly absent) variable is always safely ignored. Only
uncomment a line once you have a real value to put after the `=`.

None of the variables in `.env.example` are required just to run the app
locally with the stock demo config (SQLite, guest auth) — they're only
needed for the features that use them: GitHub integration, production
Postgres, OCI/Azure provisioning, and the SAM-tool pricing integration
below. See `app-config.yaml` for local defaults — production deployments
should use `app-config.production.yaml`.

## Database as a Service template

`templates/oracle-dbaas/template.yaml` is the self-service form clients use
to request a database. It walks through:

1. **Hosting Decision** — Data Sovereignty Requirement (the only question
   here; drives step 4 below)
2. **Service Type** — Client (which tenant this is for — see below),
   Support Model (Fully Managed / Self-Supported), and Database Product
   (Oracle, SQL Server, MongoDB, PostgreSQL)
3. **Database Configuration** — name and admin password
4. **Deployment Target** — CPU/memory/storage sizing, a live cost
   comparison (Oracle only — see below), and On-Premises / OCI / Azure
   selection, with a Tenant picker once a cloud target is chosen. If Data
   Sovereignty Requirement was answered "yes", target is forced to
   On-Premises only and no tenant picker is shown.

Only Oracle provisioning is actually automated today
(`packages/backend/src/modules/oracleDbaas/`) — SQL Server, MongoDB, and
PostgreSQL are exposed in the form for discoverability but return a
"not yet automated" result on submission.

## Multi-tenant clients

Different clients can have different cloud tenants — e.g. one client with
a dev/test OCI tenancy and a separate production Azure subscription. This
is configured in `app-config.yaml` under `oracleDbaas.clients[].tenants[]`,
each tenant carrying its own full auth/network config (OCI and Azure
credentials are inherently tenant-scoped, so there's no single shared
credential set).

A new `dbaas-tenants` backend plugin
(`packages/backend/src/plugins/dbaasTenants/`) serves a sanitized version
of this list — client/tenant **names and IDs only** — to the template's
Client and Tenant pickers. The actual tenancy OCIDs/subscription
IDs/credentials never reach the browser; they're resolved server-side
(`packages/backend/src/modules/oracleDbaas/resolveTenant.ts`) only when a
provisioning action actually runs, keyed by the client + tenant picked in
the form.

`app-config.yaml` ships with one example client ("Acme Corp") with one OCI
tenant and one Azure tenant as a copy-paste starting point — adding
another client or tenant is a config + env var change only, no code
changes needed. See the comments above `oracleDbaas.clients` in
`app-config.yaml` and the matching block in `.env.example`.

## Cost comparison and the SAM-tool (Helios) pricing integration

The Deployment Target page shows a live estimated annual cost comparison
for Oracle deployments — On-Premises, OCI, and Azure (BYOL vs. License
Included) — modeled on Helios/SAM-tool's own FinOps → Options Analysis
feature. The formula is the same: `annual cost = unit price × cores ×
8760 hours`, with Azure BYOL doubling vCPUs per core to account for
Oracle's 0.5 core-factor licensing rule on Intel VMs.

Pricing is read from three sources, in priority order:

1. **Helios/SAM-tool's own imported price list** — read directly from
   SAM-tool's Postgres database (`shared.oracle_product_list_prices`), via
   the `sam-pricing` backend plugin
   (`packages/backend/src/plugins/samPricing/`). This reflects your org's
   actual imported/negotiated Oracle prices, not just public list prices.
2. **Oracle's public OCI pricing API** (`apexapps.oracle.com`) — used if
   SAM-tool's database isn't reachable or has no current price for a
   given SKU.
3. **A static fallback table** — used if neither of the above is
   reachable, so the feature never hard-fails.

Azure pricing comes from Azure's public Retail Prices API, with its own
static fallback (there's no org-specific Azure price source configured).

The footer under the comparison table names which source was actually
used, so it's obvious when it's falling back instead of using real data.

### Setting up the SAM-tool database connection

Polaris needs a **read-only** Postgres user on the SAM-tool database, plus
network access from wherever Polaris's backend runs to that database.

**1. Create the read-only user** — run this against SAM-tool's database
(not Polaris's own database), from a machine that can reach it, using an
admin/owner role on that database:

```sh
SAM_TOOL_DB_HOST=<sam-tool-db-host> \
SAM_TOOL_DB_NAME=<sam-tool-db-name> \
PGPASSWORD='<admin-password>' \
  ./scripts/create_sam_tool_readonly_user.sh <admin_user> polaris_readonly '<a-strong-password>'
```

This grants `CONNECT` on the database, `USAGE` on the `shared` schema, and
`SELECT` on `shared.oracle_product_list_prices` only — nothing else, and
no write access anywhere. See `scripts/create_sam_tool_readonly_user.sql`
for the exact grants if you want to review or adapt them.

**2. Confirm network access** — Polaris's backend process needs a route to
SAM-tool's Postgres host/port (same VPC, firewall rule, etc.). There's no
config for this; it's an infrastructure prerequisite.

**3. Fill in the SAM-tool section of your `.env`** file (copied from
`.env.example`), matching what `app-config.yaml`'s `samTool.database`
section expects:

```
SAM_TOOL_DB_HOST=<sam-tool-db-host>
SAM_TOOL_DB_PORT=5432
SAM_TOOL_DB_NAME=<sam-tool-db-name>
SAM_TOOL_DB_READONLY_USER=polaris_readonly
SAM_TOOL_DB_READONLY_PASSWORD=<the password you set in step 1>
```

Restart `yarn start` after editing `.env` — it's only loaded at startup.
Until these are set, the cost comparison still works — it just falls back
to the live public OCI API or the static table instead, and says so in the
footer.

### Other environment variables

`.env.example` documents every other variable the config files reference:
GitHub integration, production Postgres, and OCI/Azure service credentials
for actual provisioning (`OCI_TENANCY_OCID`, `AZURE_CLIENT_SECRET`, etc.).
None of these are committed; `app-config*.yaml` only ever contains
`${ENV_VAR}` references.
