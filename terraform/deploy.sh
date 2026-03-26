#!/bin/bash

#################################################
# Vanguard Terraform Quick Start Script
# This script helps you deploy the infrastructure
#################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Vanguard Azure Infrastructure Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configure Service Principal Authentication
echo -e "${BLUE}Configuring Service Principal authentication...${NC}"
export ARM_CLIENT_ID="799e7cea-c318-4d79-86ab-08e6e2218e12"
export ARM_CLIENT_SECRET="2sD8Q~_K29P.dEzQ3oe8RfkmxrAvPi5CzcCKEcu6"
export ARM_SUBSCRIPTION_ID="0d5505db-c5a0-4a2d-8e52-1ff49cd01a36"
export ARM_TENANT_ID="690e5f38-513b-4d9b-af89-1fff026133ac"
echo -e "${GREEN}✓ Service Principal credentials configured${NC}"
echo ""

# Configure PostgreSQL Password
if [ -z "$TF_VAR_postgres_password" ]; then
    echo -e "${YELLOW}! PostgreSQL password not set, using default${NC}"
    export TF_VAR_postgres_password="Postgres@123"
else
    echo -e "${GREEN}✓ PostgreSQL password configured from environment${NC}"
fi
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}✗ Terraform is not installed${NC}"
    echo "Please install Terraform from: https://www.terraform.io/downloads"
    exit 1
fi

echo -e "${GREEN}✓ Terraform is installed${NC}"
terraform version
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI is not installed${NC}"
    echo "Please install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI is installed${NC}"
az version --output table 2>/dev/null || az --version
echo ""

# Navigate to dev environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/env/dev"

echo -e "${BLUE}Working directory: $(pwd)${NC}"
echo ""

# Terraform init
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Initializing Terraform${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
terraform init

echo ""
echo -e "${GREEN}✓ Terraform initialized successfully${NC}"
echo ""

# Terraform validate
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Validating Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
terraform validate

echo ""
echo -e "${GREEN}✓ Configuration is valid${NC}"
echo ""

# Terraform plan
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Planning Infrastructure Changes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
terraform plan -out=tfplan

echo ""
echo -e "${GREEN}✓ Plan created successfully${NC}"
echo ""

# Prompt for apply
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Ready to deploy infrastructure${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
read -p "Do you want to apply these changes? (yes/no): " -r
echo ""

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Step 4: Applying Infrastructure Changes${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    terraform apply tfplan
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ Infrastructure deployed successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Extract outputs
    echo -e "${BLUE}Deployment Information:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    VM_IP=$(terraform output -raw vm_public_ip 2>/dev/null || echo "N/A")
    SSH_CMD=$(terraform output -raw ssh_command 2>/dev/null || echo "N/A")
    POSTGRES_CONN=$(terraform output -raw postgresql_connection 2>/dev/null || echo "N/A")
    
    echo ""
    echo -e "${GREEN}VM Public IP:${NC} $VM_IP"
    echo -e "${GREEN}SSH Command:${NC} $SSH_CMD"
    echo -e "${GREEN}PostgreSQL:${NC} $POSTGRES_CONN"
    echo ""
    echo -e "${YELLOW}Note: Grafana runs via Docker Compose (http://localhost:3200)${NC}"
    echo ""
    
    # Save SSH key
    echo -e "${BLUE}Saving SSH private key...${NC}"
    terraform output -raw ssh_private_key > vanguard_ssh_key.pem 2>/dev/null
    chmod 600 vanguard_ssh_key.pem
    echo -e "${GREEN}✓ SSH key saved to: vanguard_ssh_key.pem${NC}"
    echo ""
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "1. Wait 3-5 minutes for cloud-init to complete"
    echo "2. SSH into VM: $SSH_CMD"
    echo "3. Check installation: cat /var/log/cloud-init-complete.log"
    echo "4. Access Grafana: $GRAFANA_URL (admin/admin)"
    echo ""
else
    echo -e "${YELLOW}Deployment cancelled${NC}"
    echo "Plan saved to: tfplan"
    echo "You can apply it later using: terraform apply tfplan"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Deployment Script Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
