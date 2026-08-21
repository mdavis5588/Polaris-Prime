# On-prem orchestrator API contract (proposed)

Polaris Prime already has three places waiting on this:
`packages/backend/src/plugins/dbaas/provision/onprem.ts` (on-prem database
requests), `packages/backend/src/plugins/tenants/router.ts`
(`POST /:tenantId/deploy`), and
`packages/backend/src/plugins/networking/providers/onPremProvider.ts`
(Resource Groups/NSGs). All three currently throw a fixed "not yet
implemented" error. This document proposes the minimal surface the
orchestrator needs to expose for those three to become real, so it's a
concrete target rather than an open-ended "eventually it does networking."

Nothing here is final — it's a starting point for whoever builds or
integrates the orchestrator to react to, adjust, and confirm.

## Why this shape

Polaris's canonical model (see `packages/backend/src/plugins/networking/`)
is deliberately close to Azure's Resource Group / NSG shape, since that's
the model the hybrid IDP presents to users regardless of target. The
orchestrator doesn't need to *be* Azure-like internally — it just needs to
expose enough for Polaris to translate its own canonical objects into
whatever the orchestrator actually manages (VLANs, a firewall vendor API,
NSX, iptables, etc.).

## Authentication

Not yet decided (see the existing placeholder comments) — OIDC service
account vs. a proprietary bind-and-mint token. Whichever it is, Polaris's
backend needs one set of long-lived credentials per orchestrator instance,
configured similarly to `platformTenants.tenants[].azure` (env vars,
never committed).

## Resource scoping

Every call is scoped to a **resource pool id** — the
`platformTenants.tenants[].onPrem.resourcePoolId` value already in config.
The orchestrator decides what a "pool" maps to internally (a cluster, a
set of hosts, a VLAN range); Polaris just passes the id through.

## Minimal endpoints

### Resource groups (logical grouping / lifecycle scope)

```
POST   /pools/{poolId}/resource-groups
       { "name": string }
       -> 201 { "id": string }

DELETE /pools/{poolId}/resource-groups/{id}
       -> 204
```

A resource group id from this API becomes the `external_id` Polaris
stores for an on-prem `resource_groups` row, mirroring how an Azure ARM
resource group id is stored today.

### Network security groups + rules

```
POST   /pools/{poolId}/resource-groups/{rgId}/nsgs
       { "name": string }
       -> 201 { "id": string }

DELETE /pools/{poolId}/resource-groups/{rgId}/nsgs/{id}
       -> 204

POST   /pools/{poolId}/resource-groups/{rgId}/nsgs/{nsgId}/rules
       {
         "name": string,
         "priority": number,
         "direction": "inbound" | "outbound",
         "access": "allow" | "deny",
         "protocol": "tcp" | "udp" | "*",
         "sourceAddressPrefix": string,
         "sourcePortRange": string,
         "destinationAddressPrefix": string,
         "destinationPortRange": string
       }
       -> 201 { "id": string }

DELETE /pools/{poolId}/resource-groups/{rgId}/nsgs/{nsgId}/rules/{ruleName}
       -> 204
```

This is exactly the shape `NetworkProvider` in
`packages/backend/src/plugins/networking/providers/types.ts` already
expects — an `OnPremNetworkProvider` implementing it against this API
is a small, mechanical piece of work once the API exists.

### Service deployment

```
POST /pools/{poolId}/resource-groups/{rgId}/deployments
     {
       "name": string,
       "image": string,          // or whatever identifies the workload
       "cpuCores": number,
       "memoryGb": number,
       "storageGb": number,
       "nsgId": string            // which NSG's rules apply
     }
     -> 202 { "deploymentId": string, "status": "pending" }

GET  /pools/{poolId}/deployments/{deploymentId}
     -> 200 { "status": "pending" | "running" | "failed", "detail"?: string }
```

Async by design — `POST` accepts the request and returns an id; Polaris
polls (or the orchestrator later gets a webhook/callback added) rather
than blocking a request on real infrastructure provisioning, which is
likely to take longer than an HTTP request should.

## What's deliberately left open

- Whether resource groups/NSGs on the orchestrator side are truly
  separate objects, or whether "resource group" is just a naming
  convention Polaris applies to a set of NSG/deployment objects that
  don't have their own explicit container on the orchestrator. Either
  works — Polaris only needs *an* id back to store as `external_id`.
- Whether rule enforcement is synchronous (returns once applied) or
  eventually-consistent (returns once accepted). Polaris's current
  `pending → active/failed` status model on each row already
  accommodates either.
- Bulk/batch operations — not included here since Polaris's UI creates
  one object at a time; can be added later as an optimization without
  changing the shape above.
