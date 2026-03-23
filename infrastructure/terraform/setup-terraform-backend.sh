#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Terraform Backend Setup Script for Vanguard Infrastructure
# ═══════════════════════════════════════════════════════════════════════
# 
# This script creates an Azure Storage Account to store Terraform state
# remotely. Remote state is ESSENTIAL for CI/CD workflows.
#
# Prerequisites:
#   - Azure CLI installed (az)
#   - Logged in to Azure (az login)
#   - Contributor or Owner role on the subscription
#
# Usage:
#   chmod +x setup-terraform-backend.sh
#   ./setup-terraform-backend.sh
#
# ═══════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUBSCRIPTION_ID="0d5505db-c5a0-4a2d-8e52-1ff49cd01a36"
LOCATION="eastus"
RESOURCE_GROUP="vanguard-tfstate"
STORAGE_ACCOUNT="vanguardtfstate"
CONTAINER_NAME="tfstate"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}          Terraform Backend Setup for Vanguard                         ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI is not installed${NC}"
    echo -e "${YELLOW}  Please install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI found${NC}"
echo ""

# Set subscription
echo -e "${BLUE}→ Setting Azure subscription...${NC}"
az account set --subscription "${SUBSCRIPTION_ID}"
echo -e "${GREEN}✓ Subscription set to: ${SUBSCRIPTION_ID}${NC}"
echo ""

# Create resource group
echo -e "${BLUE}→ Creating resource group '${RESOURCE_GROUP}'...${NC}"
if az group show --name "${RESOURCE_GROUP}" &> /dev/null; then
    echo -e "${YELLOW}  Resource group already exists, skipping creation${NC}"
else
    az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}"
    echo -e "${GREEN}✓ Resource group created${NC}"
fi
echo ""

# Create storage account
echo -e "${BLUE}→ Creating storage account '${STORAGE_ACCOUNT}'...${NC}"
if az storage account show --name "${STORAGE_ACCOUNT}" --resource-group "${RESOURCE_GROUP}" &> /dev/null; then
    echo -e "${YELLOW}  Storage account already exists, skipping creation${NC}"
else
    az storage account create \
        --name "${STORAGE_ACCOUNT}" \
        --resource-group "${RESOURCE_GROUP}" \
        --location "${LOCATION}" \
        --sku Standard_LRS \
        --encryption-services blob \
        --min-tls-version TLS1_2 \
        --allow-blob-public-access false
    echo -e "${GREEN}✓ Storage account created${NC}"
fi
echo ""

# Get storage account key
echo -e "${BLUE}→ Getting storage account key...${NC}"
ACCOUNT_KEY=$(az storage account keys list \
    --resource-group "${RESOURCE_GROUP}" \
    --account-name "${STORAGE_ACCOUNT}" \
    --query '[0].value' -o tsv)
echo -e "${GREEN}✓ Storage account key retrieved${NC}"
echo ""

# Create blob container
echo -e "${BLUE}→ Creating blob container '${CONTAINER_NAME}'...${NC}"
if az storage container show --name "${CONTAINER_NAME}" --account-name "${STORAGE_ACCOUNT}" --account-key "${ACCOUNT_KEY}" &> /dev/null; then
    echo -e "${YELLOW}  Container already exists, skipping creation${NC}"
else
    az storage container create \
        --name "${CONTAINER_NAME}" \
        --account-name "${STORAGE_ACCOUNT}" \
        --account-key "${ACCOUNT_KEY}"
    echo -e "${GREEN}✓ Blob container created${NC}"
fi
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    Setup Complete!                                    ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo -e "1️⃣  ${YELLOW}Configure backend in Terraform:${NC}"
echo ""
echo "   Copy the example backend config:"
echo -e "   ${BLUE}cp backend-config.hcl.example backend-config.hcl${NC}"
echo ""
echo "   OR uncomment the backend block in providers.tf"
echo ""
echo -e "2️⃣  ${YELLOW}Initialize Terraform with backend:${NC}"
echo ""
echo -e "   ${BLUE}terraform init -backend-config=backend-config.hcl${NC}"
echo ""
echo -e "3️⃣  ${YELLOW}Migrate existing state (if you have local state):${NC}"
echo ""
echo "   Terraform will prompt you to migrate state when you run init"
echo ""
echo -e "4️⃣  ${YELLOW}Configure GitHub Actions:${NC}"
echo ""
echo "   The backend is already configured in .github/workflows/terraform.yml"
echo "   No additional changes needed for CI/CD"
echo ""
echo -e "${GREEN}Storage Account Details:${NC}"
echo -e "  Resource Group: ${RESOURCE_GROUP}"
echo -e "  Storage Account: ${STORAGE_ACCOUNT}"
echo -e "  Container: ${CONTAINER_NAME}"
echo -e "  Location: ${LOCATION}"
echo ""
