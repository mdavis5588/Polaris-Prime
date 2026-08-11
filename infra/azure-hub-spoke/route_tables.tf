# Four hub route tables implement the three spoke tiers plus on-prem's own
# view of the world. Reachability is controlled entirely by which table a
# connection is *associated* with (what it can see) and which table(s) it
# *propagates* into (who can see it) — see README.md for the full mechanics.
#
# rt_onprem       — what on-prem's own VPN connection can see.
# rt_onprem_only  — what an "onprem_only"-tier spoke can see (on-prem, and
#                   nothing else).
# rt_shared       — what a "shared"-tier spoke can see (on-prem, plus every
#                   other "shared"-tier spoke).
# rt_isolated     — what an "isolated"-tier spoke can see: nothing. Nothing
#                   ever propagates into it, and it never propagates
#                   anywhere, so it's unreachable in both directions —
#                   including from other isolated-tier spokes.

resource "azurerm_virtual_hub_route_table" "onprem" {
  name           = "rt-onprem"
  virtual_hub_id = azurerm_virtual_hub.this.id
  labels         = ["onprem"]
}

resource "azurerm_virtual_hub_route_table" "onprem_only" {
  name           = "rt-onprem-only"
  virtual_hub_id = azurerm_virtual_hub.this.id
  labels         = ["onprem-only"]
}

resource "azurerm_virtual_hub_route_table" "shared" {
  name           = "rt-shared"
  virtual_hub_id = azurerm_virtual_hub.this.id
  labels         = ["shared"]
}

resource "azurerm_virtual_hub_route_table" "isolated" {
  name           = "rt-isolated"
  virtual_hub_id = azurerm_virtual_hub.this.id
  labels         = ["isolated"]
}
