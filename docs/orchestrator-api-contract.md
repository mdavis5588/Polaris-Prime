# On-prem orchestrator API contract (proposed)

**Update:** the networking half of this — Resource Groups, NSGs, and
rules — is no longer waiting on this document. `onPremProvider.ts` now
provisions real VLANs and IP allocation via NetBox core, and
NSG-equivalent access lists via the community `netbox-acls` plugin (see
`packages/backend/src/plugins/networking/providers/netboxClient.ts`).
NetBox is IPAM/DCIM — a system of record, not a device controller —
so actually pushing a new VLAN/ACL onto physical switches is still a
separate step, typically a NetBox webhook triggering an Ansible/Nornir
job against your specific switch vendor. That piece isn't built here
since it depends on hardware this session has no visibility into.

What's still fully blocked on this document: **service deployment**
on-prem. `packages/backend/src/plugins/dbaas/provision/onprem.ts` and
`packages/backend/src/plugins/networking/providers/
onPremDeploymentProvider.ts` both still throw "not yet implemented" —
NetBox has no concept of compute, so deploying a VM/container/whatever
onto a tenant's VLAN needs an actual hypervisor or orchestrator
integration (vSphere, Proxmox, bare-metal PXE, a real orchestrator API),
which is what the rest of this document proposes a contract for.

Nothing here is final — it's a starting point for whoever builds or
integrates that orchestrator to react to, adjust, and confirm.

## Why this shape

Networking (Resource Groups/VLANs, NSGs/access lists) is handled by
NetBox now, so this document is scoped down to just what's still
missing: turning a tenant's on-prem VLAN into somewhere a service
actually runs. The orchestrator doesn't need to know anything about
NetBox — Polaris resolves a resource group's VLAN/subnet itself and can
pass that along in the deployment request below.

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
set of hosts, hypervisor capacity); Polaris just passes the id through.
This is a separate concept from `onPrem.netboxSiteId`, which scopes
*networking* (VLANs) — a resource pool is about compute capacity.

## Minimal endpoint

### Service deployment

```
POST /pools/{poolId}/deployments
     {
       "name": string,
       "image": string,          // or whatever identifies the workload
       "cpuCores": number,
       "memoryGb": number,
       "storageGb": number,
       "vlanId": number,          // the NetBox VLAN id to attach to
       "subnetCidr": string       // the prefix NetBox allocated for it
     }
     -> 202 { "deploymentId": string, "status": "pending" }

GET  /pools/{poolId}/deployments/{deploymentId}
     -> 200 { "status": "pending" | "running" | "failed", "detail"?: string }
```

Async by design — `POST` accepts the request and returns an id; Polaris
polls (or the orchestrator later gets a webhook/callback added) rather
than blocking a request on real infrastructure provisioning, which is
likely to take longer than an HTTP request should. This is the same
shape `DeploymentProvider` in
`packages/backend/src/plugins/networking/providers/deploymentTypes.ts`
already expects — an `OnPremDeploymentProvider` implementing it against
this API is a small, mechanical piece of work once it exists.

## What's deliberately left open

- Whether rule/deployment provisioning is synchronous (returns once
  applied) or eventually-consistent (returns once accepted). Polaris's
  current `pending → active/failed` status model on each row already
  accommodates either.
- How NSG-equivalent access-list enforcement actually reaches the
  deployed workload (applied at the VLAN/switch level via the NetBox
  webhook → Ansible path, vs. something the orchestrator itself
  enforces per-VM). Whichever it is, Polaris doesn't need to know —
  it's already writing the rules to NetBox regardless.
- Bulk/batch operations — not included here since Polaris's UI creates
  one deployment at a time; can be added later without changing the
  shape above.
