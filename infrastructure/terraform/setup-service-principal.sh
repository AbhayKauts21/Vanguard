#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════
# Azure Service Principal Setup Script for CLEO Infrastructure
# ═══════════════════════════════════════════════════════════════════════
# 
# This script creates a Service Principal with the necessary permissions
# to deploy and manage Azure resources via Terraform.
#
# Subscription: Microsoft Azure Sponsorship (0d5505db-c5a0-4a2d-8e52-1ff49cd01a36)
# Tenant: ANDINO GLOBAL TECH PRIVATE LIMITED
# Resource Group: vanguard
#
# Prerequisites:
#   - Azure CLI installed (az)
#   - Logged in to Azure (az login)
#   - Contributor or Owner role on the subscription
#
# Usage:
#   chmod +x setup-service-principal.sh
#   ./setup-service-principal.sh
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
RESOURCE_GROUP="vanguard"
SP_NAME="sp-cleo-terraform"
ROLE="Contributor"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Azure Service Principal Setup for CLEO Infrastructure  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    echo -e "   Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI is installed${NC}"

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠ Not logged in to Azure. Running 'az login'...${NC}"
    az login
fi

echo -e "${GREEN}✓ Logged in to Azure${NC}"

# Set subscription
echo -e "${BLUE}→ Setting subscription...${NC}"
az account set --subscription "$SUBSCRIPTION_ID"
CURRENT_SUB=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Using subscription: $CURRENT_SUB${NC}"

# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo -e "${GREEN}✓ Tenant ID: $TENANT_ID${NC}"

# Check if resource group exists
echo -e "${BLUE}→ Checking resource group...${NC}"
if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${GREEN}✓ Resource group '$RESOURCE_GROUP' exists${NC}"
else
    echo -e "${YELLOW}⚠ Resource group '$RESOURCE_GROUP' not found${NC}"
    read -p "Would you like to create it? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter location (default: eastus): " LOCATION
        LOCATION=${LOCATION:-eastus}
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
        echo -e "${GREEN}✓ Resource group created${NC}"
    else
        echo -e "${RED}❌ Cannot proceed without resource group${NC}"
        exit 1
    fi
fi

# Check if Service Principal already exists
echo -e "${BLUE}→ Checking for existing Service Principal...${NC}"
EXISTING_SP=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_SP" ]; then
    echo -e "${YELLOW}⚠ Service Principal '$SP_NAME' already exists (App ID: $EXISTING_SP)${NC}"
    read -p "Would you like to delete and recreate it? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}→ Deleting existing Service Principal...${NC}"
        az ad sp delete --id "$EXISTING_SP"
        echo -e "${GREEN}✓ Deleted existing Service Principal${NC}"
        sleep 5  # Wait for propagation
    else
        echo -e "${YELLOW}⚠ Using existing Service Principal. You'll need to reset the secret.${NC}"
        CLIENT_ID="$EXISTING_SP"
        
        # Reset the credential
        echo -e "${BLUE}→ Creating new credential...${NC}"
        CREDENTIAL=$(az ad sp credential reset --id "$CLIENT_ID" --query "{clientId:appId, clientSecret:password}" -o json)
        CLIENT_SECRET=$(echo "$CREDENTIAL" | jq -r '.clientSecret')
        
        echo -e "${GREEN}✓ New credential created${NC}"
    fi
fi

# Create Service Principal if it doesn't exist
if [ -z "$CLIENT_ID" ]; then
    echo -e "${BLUE}→ Creating Service Principal '$SP_NAME'...${NC}"
    
    # Get resource group ID for scoped permissions
    RG_ID=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
    
    # Create SP with Contributor role scoped to resource group
    SP_OUTPUT=$(az ad sp create-for-rbac \
        --name "$SP_NAME" \
        --role "$ROLE" \
        --scopes "$RG_ID" \
        --query "{clientId:appId, clientSecret:password, tenantId:tenant}" \
        -o json)
    
    CLIENT_ID=$(echo "$SP_OUTPUT" | jq -r '.clientId')
    CLIENT_SECRET=$(echo "$SP_OUTPUT" | jq -r '.clientSecret')
    
    echo -e "${GREEN}✓ Service Principal created successfully${NC}"
fi

# Verify Service Principal
echo -e "${BLUE}→ Verifying Service Principal...${NC}"
SP_OBJECT_ID=$(az ad sp show --id "$CLIENT_ID" --query id -o tsv)
echo -e "${GREEN}✓ Service Principal Object ID: $SP_OBJECT_ID${NC}"

# List role assignments
echo -e "${BLUE}→ Role assignments:${NC}"
az role assignment list --assignee "$CLIENT_ID" --output table

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Service Principal Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 Save these credentials securely - they won't be shown again!${NC}"
echo ""
echo -e "${BLUE}Tenant ID:${NC}       $TENANT_ID"
echo -e "${BLUE}Client ID:${NC}       $CLIENT_ID"
echo -e "${BLUE}Client Secret:${NC}   $CLIENT_SECRET"
echo -e "${BLUE}Subscription ID:${NC} $SUBSCRIPTION_ID"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Next Steps:${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "1. Copy ${BLUE}terraform.tfvars.example${NC} to ${BLUE}terraform.tfvars${NC}"
echo -e "   ${GREEN}cp terraform.tfvars.example terraform.tfvars${NC}"
echo ""
echo -e "2. Update ${BLUE}terraform.tfvars${NC} with these values:"
echo -e "   ${GREEN}tenant_id     = \"$TENANT_ID\"${NC}"
echo -e "   ${GREEN}client_id     = \"$CLIENT_ID\"${NC}"
echo -e "   ${GREEN}client_secret = \"$CLIENT_SECRET\"${NC}"
echo ""
echo -e "3. Generate SSH key pair (if not exists):"
echo -e "   ${GREEN}ssh-keygen -t rsa -b 4096 -f ~/.ssh/cleo-azure${NC}"
echo ""
echo -e "4. Add your SSH public key to ${BLUE}terraform.tfvars${NC}:"
echo -e "   ${GREEN}cat ~/.ssh/cleo-azure.pub${NC}"
echo ""
echo -e "5. Set a strong PostgreSQL password in ${BLUE}terraform.tfvars${NC}"
echo ""
echo -e "6. Initialize and apply Terraform:"
echo -e "   ${GREEN}cd infrastructure/terraform${NC}"
echo -e "   ${GREEN}terraform init${NC}"
echo -e "   ${GREEN}terraform plan${NC}"
echo -e "   ${GREEN}terraform apply${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo -e "  • Never commit terraform.tfvars to version control"
echo -e "  • Store credentials in a secure password manager"
echo -e "  • Restrict SSH access to your IP address only"
echo -e "  • Rotate credentials periodically"
echo -e "  • Enable Azure MFA for additional security"
echo ""
