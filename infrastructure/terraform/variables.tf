variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
  # No default - must be provided via TF_VAR_subscription_id or terraform.tfvars
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

variable "allowed_ssh_cidrs" {
  description = "List of CIDR blocks allowed to SSH to the VM (use ['0.0.0.0/0'] for open access, not recommended for production)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_http_cidrs" {
  description = "List of CIDR blocks allowed to access HTTP (port 80)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_https_cidrs" {
  description = "List of CIDR blocks allowed to access HTTPS (port 443)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_grafana_cidrs" {
  description = "List of CIDR blocks allowed to access Grafana (port 3000)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "postgresql_remote_access" {
  description = "Enable PostgreSQL remote access (not recommended for production unless properly secured)"
  type        = bool
  default     = false
}

variable "postgresql_allowed_cidr" {
  description = "CIDR block allowed to access PostgreSQL remotely (only used if postgresql_remote_access = true)"
  type        = string
  default     = "10.0.0.0/16"
}
