# The on-prem site and its one S2S VPN connection into the hub. This file
# is touched once, ever — adding a new Azure area never requires changing
# anything here (see spokes.tf).

resource "azurerm_vpn_site" "onprem" {
  name                = "${var.prefix}-onprem-site"
  resource_group_name = azurerm_resource_group.hub.name
  location            = azurerm_resource_group.hub.location
  virtual_wan_id      = azurerm_virtual_wan.this.id
  address_cidrs       = var.onprem.address_cidrs

  link {
    name          = var.onprem.link.name
    ip_address    = var.onprem.link.ip_address
    fqdn          = var.onprem.link.fqdn
    provider_name = var.onprem.link.provider_name
    speed_in_mbps = var.onprem.link.speed_in_mbps
  }
}

resource "azurerm_vpn_gateway_connection" "onprem" {
  name               = "${var.prefix}-onprem-conn"
  vpn_gateway_id     = azurerm_vpn_gateway.this.id
  remote_vpn_site_id = azurerm_vpn_site.onprem.id

  vpn_link {
    name             = "${var.onprem.link.name}-link"
    vpn_site_link_id = azurerm_vpn_site.onprem.link[0].id
    shared_key       = var.onprem.link.shared_key
    bandwidth_mbps   = var.onprem.link.bandwidth_mbps
  }

  routing {
    # What on-prem's traffic can reach: whatever onprem_only and shared
    # spokes have propagated into rt_onprem. Isolated spokes never appear
    # here because they never propagate anywhere.
    associated_route_table = azurerm_virtual_hub_route_table.onprem.id

    propagated_route_table {
      # Who can see on-prem: every onprem_only and shared spoke, since
      # on-prem's own prefix gets published into both of their tables.
      route_table_ids = [
        azurerm_virtual_hub_route_table.onprem_only.id,
        azurerm_virtual_hub_route_table.shared.id,
      ]
    }
  }
}
