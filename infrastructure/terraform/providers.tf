terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
  }

  # Remote state backend configuration
  # IMPORTANT: This is required for CI/CD to maintain state across runs
  # Configuration is provided via backend-config.hcl or -backend-config flags
  backend "azurerm" {
    # Configuration provided at init time via:
    # - backend-config.hcl file (for local development)
    # - -backend-config flags (for CI/CD)
    # - ARM_ environment variables from Azure login
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

provider "azuread" {
  tenant_id = var.tenant_id
}
