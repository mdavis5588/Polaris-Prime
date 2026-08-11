# The hub: one Virtual WAN, one Virtual Hub, one VPN Gateway. On-prem
# connects here exactly once, regardless of how many spokes get added later.
#
# type = "Standard" is required (not the default in every provider version)
# because custom hub route tables — the whole mechanism this module uses to
# keep spoke tiers apart — are a Standard-SKU-only feature.

resource "azurerm_resource_group" "hub" {
  name     = "${var.prefix}-hub-rg"
  location = var.location
}

resource "azurerm_virtual_wan" "this" {
  name                = "${var.prefix}-vwan"
  resource_group_name = azurerm_resource_group.hub.name
  location            = azurerm_resource_group.hub.location
  type                = "Standard"
}

resource "azurerm_virtual_hub" "this" {
  name                = "${var.prefix}-hub"
  resource_group_name = azurerm_resource_group.hub.name
  location            = azurerm_resource_group.hub.location
  virtual_wan_id      = azurerm_virtual_wan.this.id
  address_prefix      = var.hub_address_prefix
}

resource "azurerm_vpn_gateway" "this" {
  name                = "${var.prefix}-vpngw"
  resource_group_name = azurerm_resource_group.hub.name
  location            = azurerm_resource_group.hub.location
  virtual_hub_id      = azurerm_virtual_hub.this.id
}
