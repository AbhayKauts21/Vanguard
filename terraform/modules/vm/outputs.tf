output "public_ip_address" {
  description = "Public IP address of the VM"
  value       = azurerm_public_ip.public_ip.ip_address
}

output "vm_id" {
  description = "ID of the Virtual Machine"
  value       = azurerm_linux_virtual_machine.vm.id
}

output "vm_name" {
  description = "Name of the Virtual Machine"
  value       = azurerm_linux_virtual_machine.vm.name
}

output "ssh_private_key" {
  description = "Private SSH key for VM access"
  value       = tls_private_key.ssh.private_key_pem
  sensitive   = true
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh -i vanguard_ssh_key.pem ${var.admin_username}@${azurerm_public_ip.public_ip.ip_address}"
}

output "grafana_url" {
  description = "Grafana dashboard URL"
  value       = "http://${azurerm_public_ip.public_ip.ip_address}:3000"
}

output "postgresql_connection" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${var.admin_username}@${azurerm_public_ip.public_ip.ip_address}:5432/postgres"
}
