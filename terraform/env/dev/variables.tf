# Resource Group (Existing)
variable "resource_group_name" {
  description = "Name of the existing Resource Group"
  type        = string
  default     = "vanguard"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US 2"
}

# Network Variables
variable "vnet_name" {
  description = "Name of the Virtual Network"
  type        = string
  default     = "vanguard-vnet-dev"
}

variable "address_space" {
  description = "Address space for the Virtual Network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnet_name" {
  description = "Name of the Subnet"
  type        = string
  default     = "vanguard-subnet-dev"
}

variable "subnet_prefixes" {
  description = "Address prefixes for the Subnet"
  type        = list(string)
  default     = ["10.0.1.0/24"]
}

# Security Group Variables
variable "nsg_name" {
  description = "Name of the Network Security Group"
  type        = string
  default     = "vanguard-nsg-dev"
}

# VM Variables
variable "vm_name" {
  description = "Name of the Virtual Machine"
  type        = string
  default     = "vanguard-vm-dev"
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

variable "public_ip_name" {
  description = "Name of the Public IP"
  type        = string
  default     = "vanguard-public-ip-dev"
}

variable "nic_name" {
  description = "Name of the Network Interface"
  type        = string
  default     = "vanguard-nic-dev"
}

# Tags
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Environment = "Development"
    Project     = "Vanguard"
    ManagedBy   = "Terraform"
    Owner       = "DevOps Team"
  }
}

# PostgreSQL Variables
variable "postgres_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
  default     = "Postgres@123"
}
