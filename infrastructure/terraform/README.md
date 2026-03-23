# Vanguard Azure Infrastructure - Terraform

This Terraform project provisions Azure infrastructure for the Vanguard project, including networking, compute resources, and a service principal with scoped access.

## 📋 Prerequisites

1. **Terraform** installed (>= 1.5.0)
   ```bash
   brew install terraform  # macOS
   ```

2. **Azure CLI** installed and authenticated
   ```bash
   brew install azure-cli  # macOS
   az login
   ```

3. **SSH Key Pair** generated
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
   ```

4. **Azure Tenant ID** for ANDINO GLOBAL TECH PRIVATE LIMITED

5. **Service Principal** (for CI/CD automation)
   - See [AZURE_SP_SETUP.md](AZURE_SP_SETUP.md) for detailed setup instructions
   - Required for GitHub Actions workflows

## 🏗️ Infrastructure Components

### Service Principal
- **Name**: `vanguard-terraform-sp`
- **Role**: Contributor (scoped to `vanguard` resource group)
- **Lifetime**: 1 year

### Networking
- **Virtual Network**: `vanguard-vnet` (10.0.0.0/16)
- **Subnet**: `vanguard-subnet` (10.0.1.0/24)
- **Public IP**: Static Standard SKU
- **Network Security Group**: SSH, HTTP, HTTPS, Grafana (3000)

### Compute
- **VM Name**: `vanguard-vm`
- **Size**: Standard_B4ms (4 vCPU, 16GB RAM)
- **OS**: Ubuntu 22.04 LTS (Jammy)
- **Disk**: 128GB Premium SSD
- **Authentication**: SSH key only (password disabled)

### Installed Software
- **Docker** (latest stable)
- **PostgreSQL** (from Ubuntu repos)
- **� CI/CD Workflow (GitHub Actions)

This project includes automated Terraform workflows via GitHub Actions:

### Workflow Behavior

| Event | Action | Description |
|-------|--------|-------------|
| **Pull Request** → `main` | `terraform plan` | Validates changes and posts plan to PR comments |
| **Push** → `main` (merge) | `terraform apply` | Automatically deploys infrastructure |
| **Schedule** (optional) | Drift detection | Detects manual changes outside Terraform |

### Setup GitHub Actions

**Before running workflows, you must configure Azure Service Principal authentication:**

👉 **Follow the complete guide**: [AZURE_SP_SETUP.md](AZURE_SP_SETUP.md)

**Quick setup:**

```bash
# 1. Create Service Principal
az ad sp create-for-rbac \
  --name "vanguard-github-actions" \
  --role Contributor \
  --scopes /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard \
  --sdk-auth

# 2. Copy the JSON output

# 3. Add to GitHub Secrets:
#    - AZURE_CREDENTIALS (entire JSON)
#    - AZURE_TENANT_ID (from JSON)
#    - AZURE_SUBSCRIPTION_ID (or use default)
```

### Feature Branch Development Flow

```bash
# 1. Create feature branch
git checkout -b feature/add-monitoring

# 2. Make changes to Terraform files
vim infrastructure/terraform/main.tf

# 3. Commit and push
git add infrastructure/terraform/
git commit -m "Add monitoring resources"
git push origin feature/add-monitoring

# 4. Open Pull Request
# ✅ GitHub Actions runs `terraform plan`
# ✅ Plan is posted as PR comment
# ✅ Review the plan before merging

# 5. Merge to main
# ✅ GitHub Actions runs `terraform apply`
# ✅ Infrastructure is deployed automatically
```

### Workflow Configuration

The workflow file is located at [`.github/workflows/terraform.yml`](../.github/workflows/terraform.yml)

**Key features:**
- 🔍 Format validation with `terraform fmt`
- ✅ Configuration validation
- 📋 Plan generation with PR comments
- 🚀 Auto-apply on merge to main
- 🔒 Production environment protection
- 📊 Drift detection (optional)

---

## 🚀 Quick Start (Local Development)test from official repos)
- **Docker Compose** (standalone v2.24.5)
- Utilities: git, vim, htop, jq, tree

## 🚀 Quick Start

### 1. Configure Variables

Copy the example variables file:

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set your tenant ID:

```hcl
tenant_id = "your-actual-tenant-id"
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan Deployment

```bash
terraform plan
```

Review the planned changes carefully.

### 4. Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted.

### 5. Retrieve Outputs

After successful deployment:

```bash
# Get VM public IP
terraform output public_ip_address

# Get SSH command
terraform output ssh_command

# Get Grafana URL
terraform output grafana_url

# Get Service Principal credentials (sensitive)
terraform output -json service_principal_credentials
```

### 6. Connect to VM

```bash
# SSH into the VM
ssh azureadmin@<PUBLIC_IP>

# Check initialization log
tail -f /var/log/vanguard-init.log

# View system info
cat /opt/vanguard/system-info.txt
```

## 📁 Project Structure

```
infrastructure/terraform/
├── README.md                    # This file
├── providers.tf                 # Provider configuration (AzureRM, AzureAD)
├── variables.tf                 # Input variable definitions
├── main.tf                      # Main resource definitions
├── outputs.tf                   # Output values
├── init.sh                      # VM initialization script
├── terraform.tfvars.example     # Example variables file
└── terraform.tfvars             # Your actual variables (git-ignored)
```

## 🔐 Security Considerations

1. **Service Principal Credentials**: Stored in Terraform state file (sensitive)
   - Keep state file secure and never commit to version control
   - Consider using remote state with encryption (e.g., Azure Storage with encryption)

2. **SSH Access**: Only SSH key authentication enabled
   - Ensure your private key (`~/.ssh/id_rsa`) is protected (chmod 600)

3. **Network Security Group**: 
   - Ports 22, 80, 443, 3000, 5432 are open
   - Consider restricting source IP ranges for production

4. **PostgreSQL**: Configured to accept remote connections
   - Change default postgres password immediately after deployment
   - Restrict access in production environments

5. **Grafana**: Default credentials are admin/admin
   - Change on first login

## 🧪 Post-Deployment Verification

```bash
# SSH into VM
ssh azureadmin@$(terraform output -raw public_ip_address)

# Verify Docker
docker --version
docker ps

# Verify PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# Verify Grafana
sudo systemctl status grafana-server
curl -I http://localhost:3000

# Check initialization status
cat /opt/vanguard/.initialization-complete
```

## 🔧 Common Operations

### Update Infrastructure

```bash
# Modify main.tf or variables
terraform plan
terraform apply
```

### Destroy Infrastructure

⚠️ **Warning**: This will delete all resources except the resource group

```bash
terraform destroy
```

### View Current State

```bash
terraform show
terraform state list
```

### Refresh State

```bash
terraform refresh
```

## 🔄 Service Principal Authentication

To use the created service principal for automation:

```bash
# Get credentials
SP_CREDS=$(terraform output -json service_principal_credentials)

# Login with service principal
az login --service-principal \
  -u $(echo $SP_CREDS | jq -r '.client_id') \
  -p $(echo $SP_CREDS | jq -r '.client_secret') \
  --tenant $(echo $SP_CREDS | jq -r '.tenant_id')
```

## 📊 Resource Tags

All resources are tagged with:
- `project = "vanguard"`
- `environment = "demo"`

Customize tags in `variables.tf` or `terraform.tfvars`.

## 🐛 Troubleshooting

### Error: Resource group not found
- Ensure the `vanguard` resource group exists in your subscription
- Verify you're authenticated to the correct subscription: `az account show`

### Error: Service Principal creation failed
- Ensure you have sufficient permissions in Azure AD
- Check if you're an Owner or Global Administrator

### VM Initialization Script Not Running
- Check cloud-init logs: `sudo cat /var/log/cloud-init-output.log`
- Check custom script: `sudo cat /var/log/vanguard-init.log`

### SSH Connection Refused
- Check NSG rules allow port 22
- Verify public IP is correctly assigned
- Ensure VM is fully started: `az vm show -n vanguard-vm -g vanguard --query "provisioningState"`

## 📚 Additional Resources

- [Terraform Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Virtual Machines Documentation](https://docs.microsoft.com/azure/virtual-machines/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)

## 📝 License

This infrastructure code is part of the Vanguard project.

---

**Tenant**: ANDINO GLOBAL TECH PRIVATE LIMITED  
**Subscription**: 0d5505db-c5a0-4a2d-8e52-1ff49cd01a36  
**Resource Group**: vanguard  
**Managed by**: Terraform
