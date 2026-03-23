variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
  default     = "0d5505db-c5a0-4a2d-8e52-1ff49cd01a36"
}

variable "tenant_id" {
  description = "Azure Tenant ID for ANDINO GLOBAL TECH PRIVATE LIMITED"
  type        = string
}

variable "resource_group_name" {
  description = "Existing Azure Resource Group name"
  type        = string
  default     = "vanguard"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "vanguard"
}

variable "environment" {
  description = "Environment identifier"
  type        = string
  default     = "demo"
}

variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnet_address_prefix" {
  description = "Address prefix for the subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "vm_size" {
  description = "Size of the virtual machine"
  type        = string
  default     = "Standard_B4ms"
}

variable "admin_username" {
  description = "Administrator username for the VM"
  type        = string
  default     = "azureadmin"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    project     = "vanguard"
    environment = "demo"
  }
}
