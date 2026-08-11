output "hub_id" {
  value = azurerm_virtual_hub.this.id
}

output "vpn_gateway_id" {
  value = azurerm_vpn_gateway.this.id
}

output "route_table_ids" {
  value = {
    onprem      = azurerm_virtual_hub_route_table.onprem.id
    onprem_only = azurerm_virtual_hub_route_table.onprem_only.id
    shared      = azurerm_virtual_hub_route_table.shared.id
    isolated    = azurerm_virtual_hub_route_table.isolated.id
  }
}

output "spoke_vnet_ids" {
  value = { for k, v in azurerm_virtual_network.spoke : k => v.id }
}

output "spoke_tiers" {
  value = { for k, v in var.spokes : k => v.tier }
}
