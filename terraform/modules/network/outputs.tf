output "vnet_id" {
  description = "ID of the Virtual Network"
  value       = azurerm_virtual_network.vnet.id
}

output "vnet_name" {
  description = "Name of the Virtual Network"
  value       = azurerm_virtual_network.vnet.name
}

output "subnet_id" {
  description = "ID of the Subnet"
  value       = azurerm_subnet.subnet.id
}

output "subnet_name" {
  description = "Name of the Subnet"
  value       = azurerm_subnet.subnet.name
}
