terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "vanguard"
    storage_account_name = "vanguardtfstate"
    container_name       = "tfstate"
    key                  = "vanguard.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Data source to reference existing resource group
data "azurerm_resource_group" "existing" {
  name = var.resource_group_name
}

# Network Module
module "network" {
  source = "../../modules/network"

  vnet_name           = var.vnet_name
  address_space       = var.address_space
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_name         = var.subnet_name
  subnet_prefixes     = var.subnet_prefixes
  tags                = var.tags
}

# Security Group Module
module "security_group" {
  source = "../../modules/security_group"

  nsg_name            = var.nsg_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

# VM Module
module "vm" {
  source = "../../modules/vm"

  vm_name             = var.vm_name
  location            = var.location
  resource_group_name = var.resource_group_name
  vm_size             = var.vm_size
  admin_username      = var.admin_username
  subnet_id           = module.network.subnet_id
  nsg_id              = module.security_group.nsg_id
  public_ip_name      = var.public_ip_name
  nic_name            = var.nic_name
  postgres_password   = var.postgres_password
  postgres_db         = var.postgres_db
  postgres_user       = var.postgres_user
  tags                = var.tags

  depends_on = [
    module.network,
    module.security_group
  ]
}
