# Vanguard Infrastructure

Complete guide to understanding, deploying, and managing the Vanguard Azure infrastructure using Terraform and GitHub Actions.

---

## 📋 Table of Contents

- [CI/CD Workflow Overview](#cicd-workflow-overview)
- [Pull Request Workflow](#pull-request-workflow)
- [Merge to Main Workflow](#merge-to-main-workflow)
- [Azure Resources Deployed](#azure-resources-deployed)
- [Connecting to the Server](#connecting-to-the-server)
- [Post-Deployment Access](#post-deployment-access)
- [Quick Reference](#quick-reference)

---

## 🔄 CI/CD Workflow Overview

The Vanguard infrastructure uses **GitHub Actions** to automate Terraform deployments with a secure, production-ready workflow.

### Workflow Triggers

| Event | Trigger Path | Action |
|-------|-------------|--------|
| **Pull Request** | `infrastructure/terraform/**` or `.github/workflows/terraform.yml` | Runs `terraform plan` and posts results as PR comment |
| **Push to Main** | `infrastructure/terraform/**` or `.github/workflows/terraform.yml` | Runs `terraform apply` to deploy infrastructure |
| **Daily Schedule** | Cron: `0 6 * * *` (6 AM UTC) | Checks for infrastructure drift |

---

## 🔍 Pull Request Workflow

### What Happens When You Raise a Pull Request?

When you create a pull request that modifies infrastructure code, the following automated workflow is triggered:

#### Step-by-Step Process

1. **Code Checkout**
   - GitHub Actions clones your feature branch

2. **Terraform Setup**
   - Installs Terraform v1.5.0
   - Authenticates with Azure using Service Principal credentials

3. **Format Check**
   - Runs `terraform fmt -check -recursive`
   - Validates code formatting standards

4. **Terraform Init**
   - Initializes Terraform working directory
   - Downloads required provider plugins (AzureRM, AzureAD)

5. **Terraform Validate**
   - Validates configuration syntax
   - Checks for structural errors

6. **Terraform Plan** 🎯
   - Generates execution plan showing:
     - Resources to be **created** (green `+`)
     - Resources to be **modified** (yellow `~`)
     - Resources to be **destroyed** (red `-`)
     - No changes (white)
   - Saves plan to artifact storage

7. **PR Comment** 💬
   - Posts formatted plan output as PR comment
   - Includes:
     - Format check status 🖌
     - Initialization status ⚙️
     - Validation status 🤖
     - **Full Terraform plan** 📖
     - Actor information

#### Example PR Comment

```
#### Terraform Format and Style 🖌 success
#### Terraform Initialization ⚙️ success
#### Terraform Validation 🤖 success

#### Terraform Plan 📖 success

<details><summary>Show Plan</summary>

Terraform will perform the following actions:

  # azurerm_linux_virtual_machine.vanguard_vm will be created
  + resource "azurerm_linux_virtual_machine" "vanguard_vm" {
      + name              = "vanguard-vm"
      + size              = "Standard_B4ms"
      + location          = "eastus"
      ...
    }

Plan: 12 to add, 0 to change, 0 to destroy.
</details>

*Pusher: @username, Action: pull_request, Workflow: Terraform Infrastructure*
```

#### What You Can Do

✅ **Review the plan** carefully in the PR comment  
✅ **Request changes** if unexpected resources appear  
✅ **Approve and merge** when plan looks correct  
❌ **No infrastructure changes** are applied at this stage (read-only)

---

## 🚀 Merge to Main Workflow

### What Happens After Code is Merged to Main?

Once your pull request is **approved and merged** into the `main` branch, the deployment workflow automatically starts:

#### Step-by-Step Process

1. **Production Environment Check** 🔒
   - Requires approval from configured reviewers (if enabled)
   - Ensures production safety gate

2. **Code Checkout**
   - Clones the latest `main` branch

3. **Terraform Setup**
   - Installs Terraform v1.5.0
   - Authenticates with Azure using Service Principal

4. **Terraform Init**
   - Initializes working directory

5. **Terraform Plan**
   - Re-generates execution plan
   - Ensures changes match PR preview

6. **Terraform Apply** 🎯
   - **Automatically applies** changes (`-auto-approve`)
   - Creates/updates/deletes Azure resources
   - Typically takes **8-15 minutes** for full deployment

7. **Terraform Output**
   - Extracts deployment information:
     - Public IP address
     - SSH connection command
     - Grafana URL
     - PostgreSQL connection details

8. **Workflow Summary**
   - Posts deployment summary with access information
   - Available in Actions tab → Workflow run summary

#### Timeline

| Stage | Duration | Description |
|-------|----------|-------------|
| **Initialization** | 30-60 seconds | Terraform setup and authentication |
| **Planning** | 20-40 seconds | Generate execution plan |
| **VM Creation** | 5-8 minutes | Provision VM, networking, security |
| **Software Installation** | 3-5 minutes | Docker, PostgreSQL, Grafana setup via init.sh |
| **Finalization** | 30-60 seconds | Apply completion and output extraction |
| **Total** | **~8-15 minutes** | Full deployment time |

---

## ☁️ Azure Resources Deployed

### Complete Resource Inventory

The following Azure resources are created when Terraform applies your infrastructure:

#### Resource Summary Table

| Category | Resource Type | Resource Name | Details |
|----------|--------------|---------------|---------|
| **Identity** | Azure AD Application | `vanguard-terraform-sp` | Service Principal for Terraform automation |
| **Identity** | Service Principal | `vanguard-terraform-sp` | Automated identity with Contributor role |
| **Identity** | SP Password/Secret | Auto-generated | Valid for 1 year (8760 hours) |
| **Identity** | Role Assignment | Contributor | Scoped to `vanguard` resource group |
| **Network** | Virtual Network | `vanguard-vnet` | Address space: `10.0.0.0/16` |
| **Network** | Subnet | `vanguard-subnet` | Address prefix: `10.0.1.0/24` (256 IPs) |
| **Network** | Network Security Group | `vanguard-nsg` | 4 inbound rules (SSH, HTTP, HTTPS, Grafana) |
| **Network** | Public IP Address | `vanguard-public-ip` | Static, Standard SKU |
| **Network** | Network Interface | `vanguard-nic` | Dynamic private IP + public IP |
| **Network** | NSG Association | NIC ↔ NSG | Associates security rules with NIC |
| **Compute** | Linux Virtual Machine | `vanguard-vm` | Ubuntu 22.04 LTS, Standard_B4ms |
| **Storage** | OS Disk | `vanguard-os-disk` | 128 GB Premium SSD (P10) |

**Total Resources Created:** **12 Azure resources**

---

### Detailed Resource Specifications

#### 1. Virtual Network (VNet)

| Property | Value |
|----------|-------|
| **Name** | `vanguard-vnet` |
| **Address Space** | `10.0.0.0/16` (65,536 IPs) |
| **Location** | `East US` |
| **DNS Servers** | Azure-provided |

#### 2. Subnet

| Property | Value |
|----------|-------|
| **Name** | `vanguard-subnet` |
| **Address Prefix** | `10.0.1.0/24` (256 IPs) |
| **Available IPs** | 251 (5 reserved by Azure) |
| **Private IP Range** | `10.0.1.4 - 10.0.1.254` |

#### 3. Network Security Group (NSG)

| Rule Name | Priority | Direction | Protocol | Port | Source | Destination | Access |
|-----------|----------|-----------|----------|------|--------|-------------|--------|
| **SSH** | 1001 | Inbound | TCP | 22 | Any | Any | Allow |
| **HTTP** | 1002 | Inbound | TCP | 80 | Any | Any | Allow |
| **HTTPS** | 1003 | Inbound | TCP | 443 | Any | Any | Allow |
| **Grafana** | 1004 | Inbound | TCP | 3000 | Any | Any | Allow |

> ⚠️ **Security Note**: The NSG allows inbound traffic from any source (`*`). For production, restrict source IPs to your organization's CIDR ranges.

#### 4. Public IP Address

| Property | Value |
|----------|-------|
| **Name** | `vanguard-public-ip` |
| **Allocation** | Static |
| **SKU** | Standard |
| **IP Version** | IPv4 |
| **Address** | Assigned at deployment time |

#### 5. Virtual Machine (VM)

| Property | Value |
|----------|-------|
| **Name** | `vanguard-vm` |
| **Operating System** | Ubuntu 22.04 LTS (Jammy) |
| **VM Size** | `Standard_B4ms` |
| **vCPUs** | 4 cores |
| **RAM** | 16 GB |
| **OS Disk Size** | 128 GB |
| **Disk Type** | Premium SSD (P10) |
| **IOPS** | 500 IOPS (read/write) |
| **Throughput** | 100 MB/s |
| **Admin Username** | `azureadmin` |
| **Authentication** | SSH public key only (password disabled) |
| **Boot Diagnostics** | Enabled (managed storage) |

#### 6. Storage

| Disk | Type | Size | Performance | Caching |
|------|------|------|-------------|---------|
| **OS Disk** | Premium SSD (P10) | 128 GB | 500 IOPS, 100 MB/s | ReadWrite |

---

### Software Stack (Installed via init.sh)

The VM is automatically provisioned with the following software during deployment:

#### Core Services

| Service | Version | Port | Description |
|---------|---------|------|-------------|
| **Docker CE** | Latest stable | - | Container runtime with BuildX and Compose plugins |
| **Docker Compose** | v2.24.5 | - | Multi-container orchestration tool (standalone binary) |
| **PostgreSQL** | 15.x | 5432 | Relational database (configured for remote access) |
| **Grafana OSS** | Latest stable | 3000 | Observability and monitoring dashboard |

#### System Utilities

| Utility | Purpose |
|---------|---------|
| `git` | Version control |
| `vim` | Text editor |
| `htop` | Process monitoring |
| `net-tools` | Network configuration tools |
| `jq` | JSON processor |
| `unzip` | Archive extraction |
| `tree` | Directory tree viewer |
| `ufw` | Uncomplicated Firewall |

#### Firewall Configuration (UFW)

| Port | Service | Status |
|------|---------|--------|
| 22 | SSH | ✅ Allowed |
| 80 | HTTP | ✅ Allowed |
| 443 | HTTPS | ✅ Allowed |
| 3000 | Grafana | ✅ Allowed |
| 5432 | PostgreSQL | ✅ Allowed |

#### PostgreSQL Configuration

- **Version**: 15.x (latest from Ubuntu repos)
- **Remote Access**: Enabled (listens on all interfaces)
- **Authentication**: MD5 password authentication
- **HBA Config**: Allows connections from any IP (`0.0.0.0/0`)
- **Default Database**: `postgres`
- **Default User**: `postgres`

> 🔧 **Action Required**: After deployment, you must set the PostgreSQL `postgres` user password:
> ```bash
> sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-secure-password';"
> ```

#### Grafana Configuration

- **Version**: Latest OSS edition
- **Default Port**: 3000
- **Default Credentials**: `admin` / `admin` (must change on first login)
- **Data Source**: Not configured (manual setup required)
- **Dashboards**: None (start with blank installation)

---

## 🔌 Connecting to the Server

### Prerequisites

Before connecting, ensure you have:

1. ✅ **SSH Key Pair**: The private key corresponding to the public key used in Terraform
   - Default location: `~/.ssh/id_rsa` (private) and `~/.ssh/id_rsa.pub` (public)
   - If you used a different key, specify it with `-i` flag

2. ✅ **Deployment Outputs**: Retrieve from Terraform outputs or GitHub Actions summary

3. ✅ **Network Access**: Ensure your local firewall allows outbound SSH (TCP/22)

---

### Method 1: Using Terraform Outputs (Recommended)

#### Step 1: Navigate to Terraform Directory

```bash
cd /Users/manuv/Miinsys/Vanguard-1/infrastructure/terraform
```

#### Step 2: View Public IP Address

```bash
terraform output public_ip_address
```

**Example Output:**
```
"20.232.147.89"
```

#### Step 3: Get SSH Command

```bash
terraform output ssh_command
```

**Example Output:**
```
"ssh azureadmin@20.232.147.89"
```

#### Step 4: Connect to VM

```bash
# Copy the SSH command from output and run it
ssh azureadmin@20.232.147.89
```

---

### Method 2: Using Azure Portal

1. **Navigate to Azure Portal**
   - URL: https://portal.azure.com

2. **Go to Virtual Machine**
   - Search for `vanguard-vm` in the search bar
   - Click on the VM name

3. **Copy Public IP Address**
   - Look for "Public IP address" in the Overview section
   - Copy the IP address (e.g., `20.232.147.89`)

4. **Connect via SSH**
   ```bash
   ssh azureadmin@<PUBLIC_IP_ADDRESS>
   ```

---

### Method 3: Using GitHub Actions Output

1. **Open GitHub Repository**
   - Navigate to: https://github.com/your-org/vanguard-1

2. **Go to Actions Tab**
   - Click on "Actions" in the top navigation

3. **Select Latest Workflow Run**
   - Click on the most recent "Terraform Infrastructure" workflow
   - Ensure it's from the `main` branch (indicates apply completed)

4. **View Summary**
   - Scroll to the workflow summary
   - Find the "Terraform Output" section
   - Copy the SSH command or public IP

5. **Connect via SSH**
   ```bash
   ssh azureadmin@<PUBLIC_IP_ADDRESS>
   ```

---

### Method 4: Direct SSH with Custom Key

If you're using a custom SSH key (not `~/.ssh/id_rsa`):

```bash
# Specify custom key path
ssh -i /path/to/your/private-key azureadmin@<PUBLIC_IP_ADDRESS>

# Example with custom key
ssh -i ~/.ssh/vanguard_deployment_key azureadmin@20.232.147.89
```

---

### Method 5: SSH Config File (Convenience)

For frequent connections, add an entry to your SSH config:

#### Step 1: Edit SSH Config

```bash
vim ~/.ssh/config
```

#### Step 2: Add Host Entry

```ssh-config
Host vanguard
    HostName 20.232.147.89
    User azureadmin
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

#### Step 3: Connect Using Alias

```bash
ssh vanguard
```

---

### Troubleshooting SSH Connection

#### Issue: Permission Denied (publickey)

**Cause**: Wrong SSH key or key not found

**Solution**:
```bash
# Verify SSH key exists
ls -la ~/.ssh/id_rsa

# Check key permissions (should be 600)
chmod 600 ~/.ssh/id_rsa

# Ensure public key matches what was used in Terraform
cat ~/.ssh/id_rsa.pub
```

#### Issue: Connection Timeout

**Cause**: NSG rules not applied or incorrect IP

**Solution**:
```bash
# Verify NSG rule exists for SSH (port 22)
# Check Azure Portal → vanguard-nsg → Inbound security rules

# Test network connectivity
ping <PUBLIC_IP_ADDRESS>
telnet <PUBLIC_IP_ADDRESS> 22
```

#### Issue: Host Key Verification Failed

**Cause**: VM was redeployed with same IP but new host key

**Solution**:
```bash
# Remove old host key from known_hosts
ssh-keygen -R <PUBLIC_IP_ADDRESS>

# Or edit manually
vim ~/.ssh/known_hosts
# Delete the line matching the IP address
```

---

## 🌐 Post-Deployment Access

### Accessing Grafana

Once connected, access Grafana from your local browser:

#### Step 1: Get Grafana URL

```bash
terraform output grafana_url
```

**Example Output:**
```
"http://20.232.147.89:3000"
```

#### Step 2: Open in Browser

```bash
open http://20.232.147.89:3000
# Or manually paste URL into browser
```

#### Step 3: Login

- **Username**: `admin`
- **Password**: `admin` (change on first login)

#### Step 4: Change Default Password

Grafana will prompt you to change the default password immediately after first login.

---

### Accessing PostgreSQL

#### From Local Machine (External Access)

```bash
# Install PostgreSQL client (if not already installed)
# macOS
brew install postgresql

# Linux
sudo apt-get install postgresql-client

# Connect to remote PostgreSQL
psql -h <PUBLIC_IP_ADDRESS> -p 5432 -U postgres -d postgres
```

**Example:**
```bash
psql -h 20.232.147.89 -p 5432 -U postgres -d postgres
```

> 🔑 **First-Time Setup**: You must set the `postgres` user password from the VM first:
> ```bash
> ssh azureadmin@<PUBLIC_IP_ADDRESS>
> sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-secure-password';"
> ```

#### From Within the VM (Local Access)

```bash
# SSH into VM first
ssh azureadmin@<PUBLIC_IP_ADDRESS>

# Switch to postgres user
sudo -u postgres psql

# Or connect directly
psql -U postgres -d postgres
```

---

### Accessing Docker

#### Check Docker Status

```bash
ssh azureadmin@<PUBLIC_IP_ADDRESS>

# Check Docker version
docker --version

# Check running containers
docker ps

# Check Docker Compose version
docker-compose --version
```

#### View Docker Info

```bash
# Display Docker system information
docker info

# Check available resources
docker system df
```

---

### Verifying Installation

Run this command to check all services after connecting:

```bash
ssh azureadmin@<PUBLIC_IP_ADDRESS>

# Check all services
sudo systemctl status docker
sudo systemctl status postgresql
sudo systemctl status grafana-server

# View installation log
cat /var/log/vanguard-init.log

# View system information
cat /opt/vanguard/system-info.txt
```

---

## 📚 Quick Reference

### Terraform Commands

```bash
# Navigate to Terraform directory
cd infrastructure/terraform

# View all outputs
terraform output

# View specific output (no quotes)
terraform output public_ip_address
terraform output ssh_command
terraform output grafana_url

# View sensitive outputs
terraform output service_principal_credentials

# Refresh outputs (if needed)
terraform refresh
```

### SSH Commands

```bash
# Basic connection
ssh azureadmin@<PUBLIC_IP>

# With custom key
ssh -i ~/.ssh/custom_key azureadmin@<PUBLIC_IP>

# With verbose output (debugging)
ssh -v azureadmin@<PUBLIC_IP>

# Copy file to VM
scp /local/file azureadmin@<PUBLIC_IP>:/remote/path

# Copy file from VM
scp azureadmin@<PUBLIC_IP>:/remote/file /local/path

# Run single command without interactive session
ssh azureadmin@<PUBLIC_IP> 'docker ps'
```

### Service URLs

| Service | URL Pattern | Default Port |
|---------|-------------|--------------|
| **SSH** | `ssh azureadmin@<PUBLIC_IP>` | 22 |
| **Grafana** | `http://<PUBLIC_IP>:3000` | 3000 |
| **PostgreSQL** | `postgresql://postgres@<PUBLIC_IP>:5432/postgres` | 5432 |

### Default Credentials

| Service | Username | Password | Notes |
|---------|----------|----------|-------|
| **VM SSH** | `azureadmin` | SSH key only | No password authentication |
| **Grafana** | `admin` | `admin` | Must change on first login |
| **PostgreSQL** | `postgres` | Not set | Must set manually after deployment |

---

## 🔐 Security Best Practices

### Immediate Actions After Deployment

1. **Change Grafana Password**
   ```bash
   # Login to Grafana and change password when prompted
   # URL: http://<PUBLIC_IP>:3000
   ```

2. **Set PostgreSQL Password**
   ```bash
   ssh azureadmin@<PUBLIC_IP>
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-secure-password';"
   ```

3. **Review NSG Rules**
   - Consider restricting source IPs from `*` to your organization's CIDR
   - Apply principle of least privilege

4. **Enable Azure Bastion (Optional)**
   - For production: Use Azure Bastion instead of public SSH
   - Remove NSG SSH rule and use Bastion for secure access

5. **Configure Backup**
   - Enable Azure Backup for VM
   - Configure PostgreSQL automated backups
   - Set retention policies

---

## 📖 Additional Documentation

- **Terraform Deployment Guide**: [infrastructure/terraform/README.md](terraform/README.md)
- **Azure Service Principal Setup**: [infrastructure/terraform/AZURE_SP_SETUP.md](terraform/AZURE_SP_SETUP.md)
- **CI/CD Quick Start**: [infrastructure/terraform/CICD_QUICK_START.md](terraform/CICD_QUICK_START.md)
- **Feature Tracking**: [docs/features.md](../docs/features.md)

---

## 🆘 Support

### Common Issues

| Issue | Solution |
|-------|----------|
| **Cannot connect via SSH** | Verify SSH key, check NSG rules, confirm VM is running |
| **Grafana not accessible** | Check UFW status, verify port 3000 is open, check service status |
| **PostgreSQL connection refused** | Verify `postgresql.conf` and `pg_hba.conf`, check service status |
| **Terraform apply fails** | Check Azure credentials, verify subscription quota, review error logs |

### Getting Help

- **GitHub Issues**: https://github.com/your-org/vanguard-1/issues
- **Azure Support**: https://portal.azure.com → Help + support
- **Terraform Docs**: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs

---

## 📊 Monitoring and Maintenance

### Daily Tasks

```bash
# Check VM health
ssh azureadmin@<PUBLIC_IP> 'uptime && df -h && free -h'

# Check Docker containers
ssh azureadmin@<PUBLIC_IP> 'docker ps -a'

# Check logs
ssh azureadmin@<PUBLIC_IP> 'tail -50 /var/log/vanguard-init.log'
```

### Weekly Tasks

- Review Grafana dashboards
- Check PostgreSQL database sizes
- Verify backup completion
- Review Azure cost analysis

### Monthly Tasks

- Apply security updates: `sudo apt-get update && sudo apt-get upgrade`
- Rotate Service Principal credentials (if needed)
- Review and optimize NSG rules
- Audit access logs

---

**Last Updated**: 2026-03-23  
**Terraform Version**: 1.5.0  
**Infrastructure Version**: v0.9.0
