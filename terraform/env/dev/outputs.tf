# Network Outputs
output "vnet_id" {
  description = "ID of the Virtual Network"
  value       = module.network.vnet_id
}

output "subnet_id" {
  description = "ID of the Subnet"
  value       = module.network.subnet_id
}

# Security Group Outputs
output "nsg_id" {
  description = "ID of the Network Security Group"
  value       = module.security_group.nsg_id
}

# VM Outputs
output "vm_public_ip" {
  description = "Public IP address of the VM"
  value       = module.vm.public_ip_address
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = module.vm.ssh_command
}

output "ssh_private_key" {
  description = "Private SSH key (save to file: terraform output -raw ssh_private_key > vanguard_ssh_key.pem)"
  value       = module.vm.ssh_private_key
  sensitive   = true
}

output "grafana_url" {
  description = "Grafana dashboard URL (default credentials: admin/admin)"
  value       = module.vm.grafana_url
}

output "postgresql_connection" {
  description = "PostgreSQL connection string"
  value       = module.vm.postgresql_connection
}

# Summary Output
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    resource_group = var.resource_group_name
    location       = var.location
    vm_name        = var.vm_name
    vm_size        = var.vm_size
    public_ip      = module.vm.public_ip_address
    grafana_url    = module.vm.grafana_url
  }
}
