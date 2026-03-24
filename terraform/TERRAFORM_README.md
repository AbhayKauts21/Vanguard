# Vanguard Azure Infrastructure - Terraform

Production-ready, modular Terraform infrastructure for deploying Azure resources including Virtual Network, Network Security Group, and Linux VM with Docker, PostgreSQL, and Grafana pre-installed.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Local Deployment](#local-deployment)
- [GitHub Actions Deployment](#github-actions-deployment)
- [Accessing Resources](#accessing-resources)
- [Outputs](#outputs)
- [Module Documentation](#module-documentation)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Cleanup](#cleanup)

---

## 🏗️ Architecture Overview

This Terraform project creates the following Azure resources in the **existing** `vanguard` Resource Group:

- **Virtual Network** (VNet) - `10.0.0.0/16`
- **Subnet** - `10.0.1.0/24`
- **Network Security Group** (NSG) with rules for:
  - SSH (port 22)
  - HTTP (port 80)
  - Grafana (port 3000)
  - PostgreSQL (port 5432)
- **Public IP** (Static)
- **Network Interface** (NIC)
- **Linux Virtual Machine** (Ubuntu 22.04 LTS)
  - Size: Standard_B2s
  - Pre-installed: Docker, PostgreSQL, Grafana

### Infrastructure Components

```
vanguard (Resource Group)
├── vanguard-vnet-dev (Virtual Network)
│   └── vanguard-subnet-dev (Subnet)
├── vanguard-nsg-dev (Network Security Group)
├── vanguard-public-ip-dev (Public IP)
├── vanguard-nic-dev (Network Interface)
└── vanguard-vm-dev (Virtual Machine)
```

---

## ✅ Prerequisites

### Required Tools

- [Terraform](https://www.terraform.io/downloads) >= 1.0
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) >= 2.0
- Azure Subscription with appropriate permissions
- Service Principal with Contributor access

### Azure Requirements

1. **Existing Resource Group**: `vanguard` (East US 2)
2. **Terraform State Storage**:
   - Storage Account: `vanguardtfstate`
   - Container: `tfstate`
3. **Service Principal**: `vanguard-github-actions`

---

## 📁 Project Structure

```
terraform/
├── modules/
│   ├── network/
│   │   ├── main.tf           # VNet and Subnet resources
│   │   ├── variables.tf      # Network module variables
│   │   └── outputs.tf        # Network module outputs
│   ├── security_group/
│   │   ├── main.tf           # NSG and security rules
│   │   ├── variables.tf      # NSG module variables
│   │   └── outputs.tf        # NSG module outputs
│   └── vm/
│       ├── main.tf           # VM, NIC, Public IP resources
│       ├── variables.tf      # VM module variables
│       ├── outputs.tf        # VM module outputs
│       └── cloud-init.yaml   # Cloud-init configuration
└── env/
    └── dev/
        ├── main.tf           # Main environment configuration
        ├── variables.tf      # Environment variables
        └── outputs.tf        # Environment outputs
```

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd Vanguard-1/terraform/env/dev
```

### 2. Configure Authentication

Set Azure credentials as environment variables:

```bash
export ARM_CLIENT_ID="<service-principal-client-id>"
export ARM_CLIENT_SECRET="<service-principal-client-secret>"
export ARM_SUBSCRIPTION_ID="<azure-subscription-id>"
export ARM_TENANT_ID="<azure-tenant-id>"
```

Or use Azure CLI:

```bash
az login
```

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan Infrastructure

```bash
terraform plan
```

### 5. Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted to confirm deployment.

---

## 💻 Local Deployment

### Step-by-Step Guide

#### 1. Set Up Azure Credentials

```bash
# Using Service Principal
export ARM_CLIENT_ID="your-client-id"
export ARM_CLIENT_SECRET="your-client-secret"
export ARM_SUBSCRIPTION_ID="your-subscription-id"
export ARM_TENANT_ID="your-tenant-id"

# Verify credentials
az account show
```

#### 2. Navigate to Environment Directory

```bash
cd terraform/env/dev
```

#### 3. Initialize Terraform Backend

```bash
terraform init
```

**Note:** Backend configuration is already defined in `main.tf`, so no additional flags are needed.

#### 4. Review Configuration

```bash
# Check formatting
terraform fmt -check

# Validate configuration
terraform validate

# Review planned changes
terraform plan -out=tfplan
```

#### 5. Apply Configuration

```bash
terraform apply tfplan
```

#### 6. Save SSH Private Key

```bash
# Extract private key
terraform output -raw ssh_private_key > vanguard_ssh_key.pem

# Set secure permissions
chmod 600 vanguard_ssh_key.pem
```

---

## 🔄 GitHub Actions Deployment

### Setup GitHub Secrets

Add the following secret to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add this secret:

| Secret Name          | Description                       |
|---------------------|-----------------------------------|
| `AZURE_CREDENTIALS` | JSON object with Azure Service Principal credentials |

**Secret Format:**
```json
{
  "clientId": "<service-principal-client-id>",
  "clientSecret": "<service-principal-client-secret>",
  "subscriptionId": "<azure-subscription-id>",
  "tenantId": "<azure-tenant-id>"
}
```

📖 **See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for detailed setup instructions**

### Workflow Triggers

The workflow runs on:
- **Push** to `main` or `develop` branches (auto-deploys on `main`)
- **Pull Requests** to `main` or `develop` (plan only)
- **Manual trigger** via workflow_dispatch

### Workflow Steps

1. ✅ Checkout code
2. ✅ Azure CLI login with Service Principal
3. ✅ Setup Terraform (v1.12.2)
4. ✅ Format check
5. ✅ Initialize Terraform
6. ✅ Validate configuration
7. ✅ Plan infrastructure (create binary and JSON)
8. ✅ **Trivy security scan** (HIGH and CRITICAL vulnerabilities)
9. ✅ Upload plan artifacts
10. ✅ Apply changes (main branch only)
11. ✅ Output deployment summary

### Running the Workflow

**Automatic:**
```bash
git add .
git commit -m "Deploy infrastructure"
git push origin main
```

**Manual:**
1. Go to **Actions** tab in GitHub
2. Select **Terraform Azure Infrastructure Deployment**
3. Click **Run workflow**
4. Select branch and run

---

## 🔐 Accessing Resources

### SSH into Virtual Machine

```bash
# Get SSH command
terraform output ssh_command

# Or manually
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>
```

### Access Grafana Dashboard

```bash
# Get Grafana URL
terraform output grafana_url

# Open in browser
# Default credentials: admin / admin
```

**Grafana URL:** `http://<public-ip>:3000`

### Connect to PostgreSQL

```bash
# From local machine (if firewall allows)
psql -h <public-ip> -p 5432 -U postgres -d vanguard

# From VM
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>
sudo -u postgres psql
```

### Check Installation Status

```bash
# SSH into VM
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>

# Check cloud-init logs
cat /var/log/cloud-init-complete.log
sudo tail -f /var/log/cloud-init-output.log

# Verify services
sudo systemctl status docker
sudo systemctl status postgresql
sudo systemctl status grafana-server

# Check versions
docker --version
psql --version
grafana-server -v
```

---

## 📤 Outputs

### Available Outputs

```bash
# View all outputs
terraform output

# Specific outputs
terraform output vm_public_ip
terraform output ssh_command
terraform output grafana_url
terraform output postgresql_connection

# Get SSH private key
terraform output -raw ssh_private_key > vanguard_ssh_key.pem
```

### Output Reference

| Output                  | Description                              |
|------------------------|------------------------------------------|
| `vm_public_ip`         | Public IP address of the VM              |
| `ssh_command`          | Complete SSH command to connect to VM    |
| `ssh_private_key`      | Private SSH key (sensitive)              |
| `grafana_url`          | Grafana dashboard URL                    |
| `postgresql_connection`| PostgreSQL connection string             |
| `deployment_summary`   | Summary of all deployed resources        |

---

## 📚 Module Documentation

### Network Module

Creates Virtual Network and Subnet.

**Inputs:**
- `vnet_name` - Virtual Network name
- `address_space` - VNet address space (default: `["10.0.0.0/16"]`)
- `subnet_name` - Subnet name
- `subnet_prefixes` - Subnet address prefixes (default: `["10.0.1.0/24"]`)

**Outputs:**
- `vnet_id` - Virtual Network ID
- `subnet_id` - Subnet ID

### Security Group Module

Creates Network Security Group with firewall rules.

**Inputs:**
- `nsg_name` - NSG name
- `location` - Azure region
- `resource_group_name` - Resource Group name

**Rules:**
- SSH (22) - Priority 100
- HTTP (80) - Priority 110
- Grafana (3000) - Priority 120
- PostgreSQL (5432) - Priority 130

**Outputs:**
- `nsg_id` - Network Security Group ID

### VM Module

Creates Linux VM with Public IP, NIC, and cloud-init provisioning.

**Inputs:**
- `vm_name` - Virtual Machine name
- `vm_size` - VM size (default: `Standard_B2s`)
- `admin_username` - Admin username (default: `azureuser`)
- `subnet_id` - Subnet ID to attach
- `nsg_id` - NSG ID to associate

**Pre-installed Software:**
- Docker CE (latest)
- PostgreSQL 14
- Grafana (OSS latest)

**Outputs:**
- `public_ip_address` - VM public IP
- `ssh_command` - SSH connection command
- `ssh_private_key` - Private key for authentication
- `grafana_url` - Grafana dashboard URL

---

## ⚙️ Configuration

### Customizing Variables

Edit `terraform/env/dev/variables.tf`:

```hcl
variable "location" {
  default = "East US 2"  # Change region
}

variable "vm_size" {
  default = "Standard_B2s"   # Change VM size
}

variable "address_space" {
  default = ["10.0.0.0/16"]  # Change VNet range
}
```

### Using Different Environments

Create new environment:

```bash
mkdir -p terraform/env/prod
cp terraform/env/dev/* terraform/env/prod/
```

Update variables in `prod/variables.tf`:

```hcl
variable "vnet_name" {
  default = "vanguard-vnet-prod"
}

variable "tags" {
  default = {
    Environment = "Production"
    Project     = "Vanguard"
    ManagedBy   = "Terraform"
  }
}
```

Deploy:

```bash
cd terraform/env/prod
terraform init
terraform apply
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Backend Initialization Failed

**Error:** `Error: Failed to get existing workspaces`

**Solution:**
```bash
# Verify storage account exists
az storage account show --name vanguardtfstate --resource-group vanguard

# Check container
az storage container show --name tfstate --account-name vanguardtfstate

# Re-initialize
terraform init -reconfigure
```

#### 2. Authentication Failed

**Error:** `Error: building account: could not acquire access token`

**Solution:**
```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "<subscription-id>"

# Verify
az account show
```

#### 3. Resource Already Exists

**Error:** `A resource with the ID already exists`

**Solution:**
```bash
# Import existing resource
terraform import <resource_type>.<name> <azure_resource_id>

# Or remove from state
terraform state rm <resource_type>.<name>
```

#### 4. SSH Connection Failed

**Error:** `Permission denied (publickey)`

**Solution:**
```bash
# Ensure correct permissions
chmod 600 vanguard_ssh_key.pem

# Verify key
ssh-keygen -l -f vanguard_ssh_key.pem

# Connect with verbose output
ssh -v -i vanguard_ssh_key.pem azureuser@<public-ip>
```

#### 5. Services Not Running

**Solution:**
```bash
# SSH into VM
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>

# Check cloud-init status
cloud-init status

# View logs
sudo cat /var/log/cloud-init-output.log

# Restart services if needed
sudo systemctl restart docker
sudo systemctl restart postgresql
sudo systemctl restart grafana-server
```

---

## 🧹 Cleanup

### Destroy Infrastructure

```bash
cd terraform/env/dev

# Preview resources to be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy

# Auto-approve (use with caution)
terraform destroy -auto-approve
```

### Remove State Files

```bash
# Remove local state
rm -rf .terraform
rm terraform.tfstate*

# Remove remote state (caution!)
az storage blob delete \
  --account-name vanguardtfstate \
  --container-name tfstate \
  --name vanguard.terraform.tfstate
```

---

## 📝 Best Practices

- ✅ Always run `terraform plan` before `apply`
- ✅ Use remote state for team collaboration
- ✅ Store sensitive outputs (SSH keys) securely
- ✅ Tag all resources for cost tracking
- ✅ Use variables for environment-specific values
- ✅ Review security group rules regularly
- ✅ Keep Terraform version consistent across team
- ✅ Use GitHub Actions for automated deployments
- ✅ Enable Azure Cost Management alerts

---

## 📖 Additional Resources

- [Terraform Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Virtual Network Documentation](https://docs.microsoft.com/en-us/azure/virtual-network/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

## 🤝 Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review Terraform logs: `TF_LOG=DEBUG terraform apply`
3. Check Azure Portal for resource status
4. Review GitHub Actions workflow logs

---

## 📜 License

This project is part of the Vanguard infrastructure and is managed by the DevOps Team.

---

**Last Updated:** March 2026  
**Maintained By:** DevOps Team  
**Terraform Version:** >= 1.0  
**Azure Provider Version:** ~> 3.0
