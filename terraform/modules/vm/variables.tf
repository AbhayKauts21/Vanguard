variable "vm_name" {
  description = "Name of the Virtual Machine"
  type        = string
}

variable "location" {
  description = "Azure region for resources"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the existing Resource Group"
  type        = string
}

variable "vm_size" {
  description = "Size of the Virtual Machine"
  type        = string
  default     = "Standard_B2s"
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "subnet_id" {
  description = "ID of the Subnet"
  type        = string
}

variable "nsg_id" {
  description = "ID of the Network Security Group"
  type        = string
}

variable "public_ip_name" {
  description = "Name of the Public IP"
  type        = string
}

variable "nic_name" {
  description = "Name of the Network Interface"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "postgres_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
  default     = "Postgres@123"
}

variable "postgres_db" {
  description = "PostgreSQL database name"
  type        = string
  default     = "cleo-dev"
}

variable "postgres_user" {
  description = "PostgreSQL application user"
  type        = string
  default     = "cleouser"
}
