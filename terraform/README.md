# Terraform Azure VM with PostgreSQL

This Terraform configuration deploys an Azure Virtual Machine with PostgreSQL installed and configured automatically via cloud-init.

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

### 1. Configure Variables

Copy the example variables file and customize it:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` to set your preferences:
- Azure region
- VM size
- Database name and user
- SSH key path

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review the Plan

```bash
terraform plan
```

### 4. Deploy

```bash
terraform apply
```

Type `yes` when prompted to confirm.

## 📊 Outputs

After successful deployment, Terraform provides the following outputs:

### View All Outputs
```bash
terraform output
```

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

To destroy all resources:

```bash
terraform destroy
```

Type `yes` when prompted.

## 📝 Verification

### Check Cloud-Init Status

SSH into the VM and check cloud-init logs:

```bash
ssh azureuser@$(terraform output -raw postgres_host)

# Check cloud-init status
sudo cloud-init status

# View PostgreSQL setup log
sudo cat /var/log/postgres_setup.log

# Check PostgreSQL service
sudo systemctl status postgresql
```

### Test Database Connection

```bash
# From the VM
sudo -u postgres psql -d appdb -c "SELECT version();"
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
