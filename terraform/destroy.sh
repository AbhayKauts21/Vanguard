#!/bin/bash

#################################################
# Vanguard Terraform Destroy Script
# This script helps you safely destroy infrastructure
#################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  Vanguard Infrastructure Destruction${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Navigate to dev environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/env/dev"

echo -e "${BLUE}Working directory: $(pwd)${NC}"
echo ""

# Check if Terraform is initialized
if [ ! -d ".terraform" ]; then
    echo -e "${RED}✗ Terraform not initialized${NC}"
    echo "Please run: terraform init"
    exit 1
fi

# Show current state
echo -e "${BLUE}Current Infrastructure:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform show -no-color | head -20
echo ""

# Terraform plan destroy
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Planning Destruction${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
terraform plan -destroy

echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}⚠️  WARNING: This will destroy all infrastructure!${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "The following resources will be DESTROYED:"
echo "  - Virtual Machine (vanguard-vm-dev)"
echo "  - Public IP"
echo "  - Network Interface"
echo "  - Network Security Group"
echo "  - Virtual Network"
echo "  - Subnet"
echo ""
echo -e "${YELLOW}Note: The Resource Group 'vanguard' will NOT be deleted${NC}"
echo ""

# Confirmation
read -p "Type 'destroy' to confirm destruction: " -r
echo ""

if [[ $REPLY == "destroy" ]]; then
    echo -e "${RED}Destroying infrastructure...${NC}"
    terraform destroy -auto-approve
    
    echo ""
    echo -e "${GREEN}✓ Infrastructure destroyed successfully${NC}"
    echo ""
    
    # Clean up local files
    echo -e "${BLUE}Cleaning up local files...${NC}"
    rm -f tfplan
    rm -f vanguard_ssh_key.pem
    echo -e "${GREEN}✓ Local files cleaned${NC}"
    echo ""
else
    echo -e "${YELLOW}Destruction cancelled${NC}"
    echo "No changes were made"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Destroy Script Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
