output "resource_group_name" {
  description = "Name of the resource group"
  value       = data.azurerm_resource_group.vanguard.name
}

output "resource_group_location" {
  description = "Location of the resource group"
  value       = data.azurerm_resource_group.vanguard.location
}

output "service_principal_application_id" {
  description = "Application (Client) ID of the Service Principal"
  value       = azuread_application.vanguard_sp.client_id
  sensitive   = true
}

output "service_principal_object_id" {
  description = "Object ID of the Service Principal"
  value       = azuread_service_principal.vanguard_sp.object_id
}

output "service_principal_password" {
  description = "Password/Secret for the Service Principal"
  value       = azuread_service_principal_password.vanguard_sp.value
  sensitive   = true
}

output "vnet_id" {
  description = "ID of the Virtual Network"
  value       = azurerm_virtual_network.vanguard_vnet.id
}

output "vnet_name" {
  description = "Name of the Virtual Network"
  value       = azurerm_virtual_network.vanguard_vnet.name
}

output "subnet_id" {
  description = "ID of the Subnet"
  value       = azurerm_subnet.vanguard_subnet.id
}

output "public_ip_address" {
  description = "Public IP address of the VM"
  value       = azurerm_public_ip.vanguard_public_ip.ip_address
}

output "vm_name" {
  description = "Name of the Virtual Machine"
  value       = azurerm_linux_virtual_machine.vanguard_vm.name
}

output "vm_id" {
  description = "ID of the Virtual Machine"
  value       = azurerm_linux_virtual_machine.vanguard_vm.id
}

output "vm_private_ip" {
  description = "Private IP address of the VM"
  value       = azurerm_network_interface.vanguard_nic.private_ip_address
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.vanguard_public_ip.ip_address}"
}

output "grafana_url" {
  description = "Grafana web interface URL"
  value       = "http://${azurerm_public_ip.vanguard_public_ip.ip_address}:3000"
}

output "service_principal_credentials" {
  description = "Service Principal credentials for Azure CLI login"
  value = {
    client_id       = azuread_application.vanguard_sp.client_id
    client_secret   = azuread_service_principal_password.vanguard_sp.value
    tenant_id       = var.tenant_id
    subscription_id = var.subscription_id
  }
  sensitive = true
}
