# Azure hub-spoke, connected to one on-prem tenant

Spins up an Azure Virtual WAN hub that a single on-prem VLAN connects to
**once**, then lets you add any number of Azure "spokes" (tenants,
environments, sandboxes — whatever you're calling each Azure area) without
ever touching the on-prem side again. Each spoke is independently one of
three tiers, controlled entirely by which hub route table its connection
uses:

| Tier | Can reach on-prem? | Can reach other spokes? |
|---|---|---|
| `isolated` | No | No — not even other `isolated` spokes |
| `onprem_only` | Yes | No |
| `shared` | Yes | Yes — every other `shared`-tier spoke |

## Why route tables, not NSGs

Two layers exist in Azure networking: **routing** decides whether traffic
can arrive at all; **NSGs/firewalls** decide what's permitted once it has.
This module uses the first layer — four Virtual WAN hub route tables
(`rt-onprem`, `rt-onprem-only`, `rt-shared`, `rt-isolated`) — as the actual
isolation boundary, because a missing route is a stronger guarantee than a
rule that could be misconfigured. Each spoke's `azurerm_virtual_hub_connection`
has a `routing` block with two parts:

- `associated_route_table_id` — which table's routes this spoke uses, i.e.
  **what it can reach**.
- `propagated_route_table.route_table_ids` — which table(s) this spoke's
  own address space gets published into, i.e. **who can reach it**.

`route_tables.tf` defines the four tables. `onprem.tf` wires on-prem's own
VPN connection to see `onprem_only` + `shared` spokes and be seen by both.
`spokes.tf` has a lookup (`local.spoke_associated_route_table_id` /
`local.spoke_propagate_to_route_table_ids`) that turns a spoke's `tier`
into the right pair of route-table references — that lookup **is** the
control panel for the table above.

An empty NSG is still created per spoke (`spokes.tf`) as a second layer —
Azure's platform defaults already deny inbound Internet and allow
VNet-internal traffic, so it's a placeholder for L3/L4 rules you add later,
not the isolation boundary itself.

## Requirements

- [OpenTofu](https://opentofu.org/) >= 1.6 (this is plain HCL against the
  `hashicorp/azurerm` provider, so real Terraform >= 1.6 works identically)
- An Azure subscription, and `az login` (or another auth method the
  `azurerm` provider supports) before running anything
- The Virtual WAN must be `type = "Standard"` (set in `hub.tf`) — custom
  hub route tables are a Standard-only feature. Basic won't work here.
- A VPN-capable device on-prem (or whatever terminates the S2S tunnel) and
  its public IP/FQDN, for `onprem.link` in your tfvars

## Use

```bash
cd infra/azure-hub-spoke
cp terraform.tfvars.example terraform.tfvars   # fill in real values — see backend.tf before doing this for real
tofu init
tofu validate
tofu plan
tofu apply
```

## Adding a new Azure tenant/area

Add an entry to the `spokes` map in your tfvars — nothing else changes:

```hcl
spokes = {
  # ...existing spokes...
  new-tenant = {
    address_space         = ["10.104.0.0/16"]
    subnet_address_prefix = "10.104.0.0/24"
    tier                  = "onprem_only"
  }
}
```

`tofu apply` creates its resource group, VNet, subnet, NSG, and hub
connection — the on-prem VPN site/connection in `onprem.tf` is untouched.

## What this doesn't do (yet)

- **Single Azure subscription.** Every spoke lands in the subscription your
  `az login`/provider context points at. If you want a harder boundary —
  separate billing, separate RBAC, a misconfigured route table in one
  tenant structurally unable to affect another — that means a subscription
  per tenant, which means aliased `azurerm` provider blocks (one per
  subscription) passed into each spoke's resources. Worth doing before
  this holds real tenant workloads; not built here since it roughly
  doubles the module's surface for something you hadn't confirmed you
  need yet.
- **ExpressRoute.** `onprem.tf` is a site-to-site VPN. Swapping to
  ExpressRoute means an `azurerm_express_route_circuit` +
  `azurerm_express_route_connection` into the same hub instead of
  `azurerm_vpn_site`/`azurerm_vpn_gateway_connection` — the hub, route
  tables, and every spoke stay exactly as they are, since routing/
  propagation works the same regardless of what kind of connection feeds
  the `rt-onprem` table.
- **NSG rules.** Each spoke gets an empty NSG to attach real rules to;
  none are defined, since what's "permitted beyond reachable" is specific
  to what you actually run in each spoke.
- **Remote state backend.** See `backend.tf` — local state holds the VPN
  shared key in plaintext; point this at Azure Storage (or your usual
  backend) before anyone but you runs `apply`.
