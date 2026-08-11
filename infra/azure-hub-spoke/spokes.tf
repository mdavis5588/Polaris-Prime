# Everything needed to spin up one new Azure area: a resource group, a
# flat VNet + subnet, an NSG placeholder, and a hub connection whose
# `routing` block is the only thing that decides which tier it's in.
# Add a tenant here (or in spokes.tfvars) and nothing in hub.tf, onprem.tf,
# or route_tables.tf ever needs to change.

locals {
  # Which route table a spoke of this tier is associated with — i.e. what
  # it can reach.
  spoke_associated_route_table_id = {
    isolated    = azurerm_virtual_hub_route_table.isolated.id
    onprem_only = azurerm_virtual_hub_route_table.onprem_only.id
    shared      = azurerm_virtual_hub_route_table.shared.id
  }

  # Which route table(s) a spoke of this tier propagates its own prefix
  # into — i.e. who can reach it. isolated propagates nowhere.
  spoke_propagate_to_route_table_ids = {
    isolated    = []
    onprem_only = [azurerm_virtual_hub_route_table.onprem.id]
    shared      = [azurerm_virtual_hub_route_table.onprem.id, azurerm_virtual_hub_route_table.shared.id]
  }
}

resource "azurerm_resource_group" "spoke" {
  for_each = var.spokes
  name     = coalesce(each.value.resource_group_name, "${var.prefix}-${each.key}-rg")
  location = var.location
}

resource "azurerm_virtual_network" "spoke" {
  for_each            = var.spokes
  name                = "${var.prefix}-${each.key}-vnet"
  resource_group_name = azurerm_resource_group.spoke[each.key].name
  location            = azurerm_resource_group.spoke[each.key].location
  address_space       = each.value.address_space
}

resource "azurerm_subnet" "spoke" {
  for_each             = var.spokes
  name                 = "default"
  resource_group_name  = azurerm_resource_group.spoke[each.key].name
  virtual_network_name = azurerm_virtual_network.spoke[each.key].name
  address_prefixes     = [each.value.subnet_address_prefix]
}

# Defense-in-depth, not the isolation boundary itself — the hub route
# table above already decides *whether* traffic can arrive at all. This
# NSG is where you add L3/L4 rules for what's permitted on top of that
# once traffic is already reachable. Empty by default: Azure's platform
# defaults already deny inbound Internet and allow VNet-internal traffic.
resource "azurerm_network_security_group" "spoke" {
  for_each            = var.spokes
  name                = "${var.prefix}-${each.key}-nsg"
  resource_group_name = azurerm_resource_group.spoke[each.key].name
  location            = azurerm_resource_group.spoke[each.key].location
}

resource "azurerm_subnet_network_security_group_association" "spoke" {
  for_each                  = var.spokes
  subnet_id                 = azurerm_subnet.spoke[each.key].id
  network_security_group_id = azurerm_network_security_group.spoke[each.key].id
}

resource "azurerm_virtual_hub_connection" "spoke" {
  for_each                  = var.spokes
  name                      = "${var.prefix}-${each.key}-conn"
  virtual_hub_id            = azurerm_virtual_hub.this.id
  remote_virtual_network_id = azurerm_virtual_network.spoke[each.key].id

  routing {
    associated_route_table_id = local.spoke_associated_route_table_id[each.value.tier]

    propagated_route_table {
      route_table_ids = local.spoke_propagate_to_route_table_ids[each.value.tier]
    }
  }
}
