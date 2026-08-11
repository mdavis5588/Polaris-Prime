# Polaris Prime

Polaris Prime is an internal developer platform built on
[Backstage](https://backstage.io), providing a self-service software
catalog and Database as a Service (DBaaS) template for provisioning Oracle,
SQL Server, MongoDB, and PostgreSQL databases on-premises, on Oracle Cloud
Infrastructure (OCI), or on Microsoft Azure.

## Getting started

```sh
yarn install
yarn start
```

This starts the frontend (`localhost:3000`) and backend (`localhost:7007`)
together. See `app-config.yaml` for local defaults (SQLite, guest auth) —
production deployments should use `app-config.production.yaml` and real
credentials via environment variables, never committed to this repo.

## Database as a Service template

`templates/oracle-dbaas/template.yaml` is the self-service form clients use
to request a database. It walks through:

1. **Hosting Decision** — workload consistency, licensing, data
   extraction/sovereignty requirements
2. **Service Type** — Support Model (Fully Managed / Self-Supported) and
   Database Product (Oracle, SQL Server, MongoDB, PostgreSQL)
3. **Database Configuration** — name and admin password
4. **Deployment Target** — CPU sizing, a live cost comparison
   (Oracle only — see below), and On-Premises / OCI / Azure selection.
   If Data Sovereignty Requirement was answered "yes", this is forced to
   On-Premises only.

Only Oracle provisioning is actually automated today
(`packages/backend/src/modules/oracleDbaas/`) — SQL Server, MongoDB, and
PostgreSQL are exposed in the form for discoverability but return a
"not yet automated" result on submission.

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

**3. Set these environment variables** for Polaris Prime's backend
(`packages/backend`), matching what `app-config.yaml`'s `samTool.database`
section expects:

```
SAM_TOOL_DB_HOST=<sam-tool-db-host>
SAM_TOOL_DB_PORT=5432
SAM_TOOL_DB_NAME=<sam-tool-db-name>
SAM_TOOL_DB_READONLY_USER=polaris_readonly
SAM_TOOL_DB_READONLY_PASSWORD=<the password you set in step 1>
```

Until these are set, the cost comparison still works — it just falls back
to the live public OCI API or the static table instead, and says so in the
footer.

### Other required environment variables

The `oracleDbaas` config section (`app-config.yaml`) also expects OCI and
Azure service credentials for actual provisioning — see the comments in
that file for the full list (`OCI_TENANCY_OCID`, `AZURE_CLIENT_SECRET`,
etc.). None of these are committed; all are `${ENV_VAR}` references.
