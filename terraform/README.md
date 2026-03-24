# Terraform Azure VM with PostgreSQL

This Terraform configuration deploys an Azure Virtual Machine with Docker, PostgreSQL, and Grafana installed and configured automatically via cloud-init.

## ⚡ Quick Reference

```bash
# Deploy infrastructure
cd terraform && ./deploy.sh

# SSH into VM (after deployment)
ssh -i terraform/env/dev/vanguard_ssh_key.pem azureuser@<VM_IP>

# Get VM IP address
cd terraform/env/dev && terraform output -raw vm_public_ip

# Destroy all resources
cd terraform && ./destroy.sh
```

## 📦 What's Deployed

- **VM**: Ubuntu 22.04 LTS (Standard_B2s)
- **Docker**: Latest version with Docker Compose
- **PostgreSQL**: Running in Docker container
- **Grafana**: Monitoring dashboard (port 3000)
- **Networking**: VNet, Subnet, NSG with SSH/HTTP/HTTPS/Grafana access
- **Storage**: Terraform state stored in Azure Storage Account

## 🔐 Security Features

- **Secure Password Generation**: Uses Terraform's `random_password` resource to generate a 16-character secure password
- **Sensitive Outputs**: Password and connection strings are marked as sensitive to prevent accidental exposure
- **No Hardcoded Credentials**: All credentials are generated or parameterized

## 📋 Prerequisites

1. **Azure CLI** installed and authenticated:
   ```bash
   az login
   ```

2. **Terraform** installed (>= 1.0):
   ```bash
   terraform version
   ```

3. **SSH Key Pair** for VM access:
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
   ```

## 🚀 Quick Start

### Option 1: Using Deploy Script (Recommended)

The easiest way to deploy is using the automated script:

```bash
# From the terraform directory
cd terraform
./deploy.sh
```

The script will:
- ✅ Check prerequisites (Terraform, Azure CLI)
- ✅ Configure Service Principal authentication
- ✅ Initialize Terraform
- ✅ Validate configuration
- ✅ Show deployment plan
- ✅ Apply changes (after your confirmation)
- ✅ Save SSH key to `terraform/env/dev/vanguard_ssh_key.pem`

**Note:** The SSH private key is saved in `terraform/env/dev/vanguard_ssh_key.pem` with proper permissions (600).

### 🔑 PostgreSQL Password Configuration

The PostgreSQL password can be configured in three ways (in order of precedence):

1. **GitHub Secret** (Recommended for CI/CD):
   - Set `POSTGRES_PASSWORD` secret in GitHub repository
   - Used automatically by GitHub Actions workflow

2. **Environment Variable** (For local deployment):
   ```bash
   export TF_VAR_postgres_password="YourSecurePassword"
   cd terraform && ./deploy.sh
   ```

3. **Default Password** (Fallback):
   - If not set via GitHub secret or environment variable
   - Default: `Postgres@123`

**Security Note:** For production deployments, always use GitHub Secrets or environment variables instead of the default password.

### 🗄️ Terraform State Backend

The Terraform state file is stored remotely in Azure Storage:

```hcl
backend "azurerm" {
  resource_group_name  = "vanguard"
  storage_account_name = "vanguardtfstate"
  container_name       = "tfstate"
  key                  = "vanguard.terraform.tfstate"
}
```

**Prerequisites:**
The storage account `vanguardtfstate` must exist before running Terraform. Create it manually:

```bash
# Create storage account for Terraform state
az storage account create \
  --name vanguardtfstate \
  --resource-group vanguard \
  --location "East US 2" \
  --sku Standard_LRS \
  --encryption-services blob

# Create container
az storage container create \
  --name tfstate \
  --account-name vanguardtfstate
```

**Benefits:**
- ✅ Shared state for team collaboration
- ✅ State locking prevents concurrent modifications
- ✅ Automatic backup and versioning
- ✅ Secure access via Azure RBAC

### Option 2: Manual Terraform Commands

If you prefer manual control:

```bash
# Navigate to dev environment
cd terraform/env/dev

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Deploy
terraform apply
```

### 🔑 Service Principal Authentication

The deploy script uses Service Principal credentials configured in the script:
- Client ID: `799e7cea-c318-4d79-86ab-08e6e2218e12`
- Subscription: `0d5505db-c5a0-4a2d-8e52-1ff49cd01a36`

**Important:** These credentials are hardcoded for convenience. For production, use environment variables or Azure Key Vault.

## 📊 Outputs

After successful deployment, Terraform provides the following outputs:

### View All Outputs
```bash
# From terraform/env/dev directory
cd terraform/env/dev
terraform output
```

### 🖥️ SSH Access to VM

**Using the saved SSH key:**
```bash
# From project root
ssh -i terraform/env/dev/vanguard_ssh_key.pem azureuser@<VM_PUBLIC_IP>

# Or navigate to the terraform directory first
cd terraform/env/dev
ssh -i vanguard_ssh_key.pem azureuser@$(terraform output -raw vm_public_ip)
```

**Get the SSH command:**
```bash
cd terraform/env/dev
terraform output -raw ssh_command
```

The SSH private key is automatically saved to `terraform/env/dev/vanguard_ssh_key.pem` with secure permissions (600).

### PostgreSQL Connection Details

| Output | Description | Command |
|--------|-------------|---------|
| `postgres_host` | VM Public IP | `terraform output postgres_host` |
| `postgres_port` | PostgreSQL Port (5432) | `terraform output postgres_port` |
| `postgres_db` | Database Name | `terraform output postgres_db` |
| `postgres_user` | Database User | `terraform output postgres_user` |
| `postgres_password` | Database Password (sensitive) | `terraform output -raw postgres_password` |
| `postgres_connection` | Full Connection String | `terraform output -raw postgres_connection` |

### Example Commands

**Get the PostgreSQL password:**
```bash
terraform output -raw postgres_password
```

**Get the full connection string:**
```bash
terraform output -raw postgres_connection
```

**SSH into the VM:**
```bash
terraform output -raw ssh_command | bash
```

## 🔗 Connect to PostgreSQL

### From Your Local Machine

```bash
# Get connection details
PGHOST=$(terraform output -raw postgres_host)
PGPASSWORD=$(terraform output -raw postgres_password)
PGUSER=$(terraform output -raw postgres_user)
PGDATABASE=$(terraform output -raw postgres_db)

# Connect using psql
psql "postgresql://$PGUSER:$PGPASSWORD@$PGHOST:5432/$PGDATABASE"
```

### Using Connection String

```bash
CONNECTION_STRING=$(terraform output -raw postgres_connection)
psql "$CONNECTION_STRING"
```

### From Application Code

**Python (psycopg2):**
```python
import psycopg2

conn = psycopg2.connect(
    host="<postgres_host>",
    port=5432,
    database="appdb",
    user="appuser",
    password="<postgres_password>"
)
```

**Node.js (pg):**
```javascript
const { Client } = require('pg');

const client = new Client({
  host: '<postgres_host>',
  port: 5432,
  database: 'appdb',
  user: 'appuser',
  password: '<postgres_password>',
});

await client.connect();
```

**Environment Variables:**
```bash
export POSTGRES_HOST=$(terraform output -raw postgres_host)
export POSTGRES_PORT=5432
export POSTGRES_DB=$(terraform output -raw postgres_db)
export POSTGRES_USER=$(terraform output -raw postgres_user)
export POSTGRES_PASSWORD=$(terraform output -raw postgres_password)
```

## 🛠️ Architecture

### Resources Created

1. **Resource Group**: Container for all resources
2. **Virtual Network**: Network for VM communication
3. **Subnet**: Isolated network segment
4. **Public IP**: Static IP for external access
5. **Network Security Group**: Firewall rules (SSH + PostgreSQL)
6. **Network Interface**: VM network connection
7. **Linux Virtual Machine**: Ubuntu 22.04 LTS
8. **Random Password**: Securely generated PostgreSQL password

### Cloud-Init Process

The VM automatically:
1. Updates packages
2. Installs PostgreSQL and extensions
3. Configures PostgreSQL to accept remote connections
4. Creates the database and user
5. Grants appropriate privileges
6. Enables PostgreSQL service on boot

### Network Security

The NSG allows inbound traffic on:
- **Port 22**: SSH access
- **Port 5432**: PostgreSQL access

⚠️ **Production Warning**: In production, restrict port 5432 to specific IP addresses or use Azure Private Link.

## 🔧 Customization

### Change Database Configuration

Edit `terraform.tfvars`:
```hcl
db_name = "mydb"
db_user = "myuser"
```

### Change VM Size

```hcl
vm_size = "Standard_D2s_v3"  # 2 vCPUs, 8 GB RAM
```

### Change Azure Region

```hcl
location = "westus2"
```

## 🧹 Cleanup

### Option 1: Using Destroy Script (Recommended)

The safest way to destroy all resources:

```bash
# From the terraform directory
cd terraform
./destroy.sh
```

The script will:
- ✅ Configure Service Principal authentication
- ✅ Show current infrastructure state
- ✅ Display resources to be destroyed
- ✅ Ask for typed confirmation ("destroy")
- ✅ Delete all infrastructure
- ✅ Clean up local files (SSH keys, plan files)

**What gets deleted:**
- Virtual Machine
- Public IP
- Network Interface
- Network Security Group
- Virtual Network and Subnet

**What stays:**
- Resource Group `vanguard` (kept intentionally)
- Storage account for Terraform state

### Option 2: Manual Terraform Destroy

```bash
# Navigate to dev environment
cd terraform/env/dev

# Destroy all resources
terraform destroy
```

Type `yes` when prompted.

**Clean up local files:**
```bash
rm -f vanguard_ssh_key.pem tfplan tfplan.binary tfplan.json
```

## 📝 Verification

### Check Cloud-Init Status

SSH into the VM and check cloud-init logs:

```bash
# From project root
ssh -i terraform/env/dev/vanguard_ssh_key.pem azureuser@<VM_PUBLIC_IP>

# Or from terraform/env/dev directory
cd terraform/env/dev
ssh -i vanguard_ssh_key.pem azureuser@$(terraform output -raw vm_public_ip)

# Once connected, check cloud-init status
sudo cloud-init status

# Check if cloud-init completed
cat /var/log/cloud-init-complete.log

# View Docker installation status
docker --version
docker compose version

# Check PostgreSQL container
docker ps | grep postgres

# Check Grafana access
curl -s http://localhost:3000 | head
```

### Test PostgreSQL Connection

```bash
# From the VM
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d vanguard_db
```

## 🔒 Security Best Practices

1. **Password Storage**: Store the password in a secure secret manager (Azure Key Vault, HashiCorp Vault, etc.)

2. **Network Security**: 
   - Use Azure Private Link for production
   - Restrict NSG rules to specific IPs
   - Use Azure Bastion for VM access

3. **State File Security**:
   - Use remote backend (Azure Storage with encryption)
   - Enable state locking
   - Never commit `terraform.tfstate` to version control

4. **Password Rotation**: Implement regular password rotation using Azure Automation or similar

Example remote backend configuration:
```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "tfstate"
    container_name       = "tfstate"
    key                  = "postgres.tfstate"
  }
}
```

## 📚 Files Structure

```
terraform/
├── main.tf                    # Main Terraform configuration
├── variables.tf               # Variable definitions
├── outputs.tf                 # Output definitions
├── cloud-init.tpl             # Cloud-init template for PostgreSQL setup
├── terraform.tfvars.example   # Example variables file
└── README.md                  # This file
```

## 🐛 Troubleshooting

### PostgreSQL not accessible

1. Check NSG rules:
   ```bash
   az network nsg rule list --resource-group postgres-rg --nsg-name pgvm-nsg
   ```

2. Check PostgreSQL is listening:
   ```bash
   ssh azureuser@$(terraform output -raw postgres_host)
   sudo netstat -tlnp | grep 5432
   ```

3. Check cloud-init logs:
   ```bash
   sudo cat /var/log/cloud-init-output.log
   ```

### Connection refused

Ensure PostgreSQL setup is complete (may take 1-2 minutes after VM creation):
```bash
ssh azureuser@$(terraform output -raw postgres_host)
sudo tail -f /var/log/postgres_setup.log
```

## 📖 Additional Resources

- [Terraform Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Cloud-Init Documentation](https://cloudinit.readthedocs.io/)

## 📄 License

This configuration is provided as-is for educational and development purposes.
