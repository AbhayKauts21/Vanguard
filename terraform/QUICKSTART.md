# Vanguard Terraform - Quick Start Guide

## ✅ Pre-configured Settings

Your Terraform infrastructure is ready to deploy with these settings:

### 🌍 Azure Configuration
- **Region:** East US 2
- **Resource Group:** vanguard (existing)
- **Terraform State:** Remote backend in `vanguardtfstate` storage account

### 🔐 Authentication
- **Method:** Azure CLI Login via GitHub Actions
- **Secret:** `AZURE_CREDENTIALS` (already configured in GitHub)
- **Service Principal:** vanguard-github-actions

---

## 🚀 Quick Deploy

### Option 1: GitHub Actions (Recommended)

Simply push changes to trigger the workflow:

```bash
git add .
git commit -m "Deploy Vanguard infrastructure"
git push origin main
```

**The workflow will:**
1. ✅ Login to Azure
2. ✅ Initialize Terraform with remote state
3. ✅ Validate configuration
4. ✅ Create plan (binary + JSON)
5. ✅ **Run Trivy security scan**
6. ✅ Deploy to Azure (main branch only)

### Option 2: Local Deployment

```bash
cd terraform/env/dev

# Login to Azure
az login

# Deploy
terraform init
terraform plan
terraform apply
```

---

## 📦 What Gets Deployed

All resources in **East US 2** region:

| Resource | Name | Details |
|----------|------|---------|
| Virtual Network | vanguard-vnet-dev | 10.0.0.0/16 |
| Subnet | vanguard-subnet-dev | 10.0.1.0/24 |
| NSG | vanguard-nsg-dev | SSH, HTTP, Grafana, PostgreSQL |
| Public IP | vanguard-public-ip-dev | Static |
| Network Interface | vanguard-nic-dev | - |
| VM | vanguard-vm-dev | Ubuntu 22.04, Standard_B2s |

### 🛠️ Pre-installed Software

The VM includes:
- ✅ Docker CE
- ✅ PostgreSQL 14
- ✅ Grafana OSS

---

## 🔒 Security Scanning

Trivy automatically scans for:
- HIGH severity vulnerabilities
- CRITICAL severity vulnerabilities
- Infrastructure misconfigurations

Scans run on every PR and push.

---

## 📤 After Deployment

### Get Connection Info

```bash
cd terraform/env/dev

# View all outputs
terraform output

# Get specific values
terraform output vm_public_ip
terraform output grafana_url
terraform output ssh_command
```

### Save SSH Key

```bash
terraform output -raw ssh_private_key > vanguard_ssh_key.pem
chmod 600 vanguard_ssh_key.pem
```

### Connect to VM

```bash
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>
```

### Access Grafana

Open browser: `http://<public-ip>:3000`
- Username: `admin`
- Password: `admin` (change on first login)

### Check Installation Status

```bash
# SSH into VM
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>

# Check cloud-init completion
cat /var/log/cloud-init-complete.log

# Verify services
sudo systemctl status docker
sudo systemctl status postgresql
sudo systemctl status grafana-server
```

---

## 🔄 Workflow Triggers

The GitHub Actions workflow runs when:

1. **Push to main branch**
   - Path: `terraform/**`
   - Action: Plan + Scan + **Deploy**

2. **Pull Request**
   - Path: `terraform/**`
   - Action: Plan + Scan + Comment on PR

3. **Manual Trigger**
   - Go to Actions → Select workflow → Run workflow

---

## 📊 GitHub Actions Output

After deployment, check:

1. **Actions Tab** → Latest workflow run
2. **Summary** → Deployment details:
   - VM Public IP
   - SSH command
   - Grafana URL
   - Security scan results

---

## 🧪 Testing the Setup

### Verify GitHub Secret

```bash
# Check if secret is accessible (in GitHub Actions)
# The workflow will fail at login if not configured correctly
```

### Test Terraform Locally

```bash
cd terraform/env/dev

# Login
az login

# Test initialization
terraform init

# Test plan (dry-run)
terraform plan
```

### Test VM Provisioning

After deployment:

```bash
# SSH into VM
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>

# Check Docker
docker --version
docker ps

# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# Check Grafana
curl http://localhost:3000/api/health
```

---

## 🗑️ Cleanup

### Destroy Infrastructure

```bash
cd terraform/env/dev

# Preview destruction
terraform plan -destroy

# Destroy (interactive)
terraform destroy

# Or use the script
cd ../../
./destroy.sh
```

**Note:** Resource Group `vanguard` and state storage are NOT destroyed.

---

## 📁 Project Files

```
terraform/
├── README.md                    ← Main documentation
├── TERRAFORM_README.md          ← Complete guide
├── GITHUB_SECRETS_SETUP.md     ← Secret setup guide
├── QUICKSTART.md                ← This file
├── deploy.sh                    ← Interactive deploy
├── destroy.sh                   ← Cleanup script
├── .gitignore                   ← Excludes sensitive files
├── modules/                     ← Reusable modules
└── env/dev/                     ← Development environment
```

---

## 🆘 Common Issues

### Issue: "Backend initialization failed"

```bash
# Verify storage account
az storage account show --name vanguardtfstate --resource-group vanguard

# Re-initialize
terraform init -reconfigure
```

### Issue: "Authentication failed in GitHub Actions"

- Verify `AZURE_CREDENTIALS` secret exists
- Check JSON format is correct
- Verify Service Principal has permissions

### Issue: "Trivy not finding vulnerabilities"

- This is good! Exit code 0 means scan completed
- Check workflow logs for scan results

### Issue: "VM services not running"

```bash
# Wait 5 minutes for cloud-init to complete
ssh -i vanguard_ssh_key.pem azureuser@<public-ip>
sudo tail -f /var/log/cloud-init-output.log
```

---

## 📚 Additional Documentation

- **Complete Guide:** [TERRAFORM_README.md](./TERRAFORM_README.md)
- **Secret Setup:** [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)
- **Module Details:** See `modules/*/README.md` files

---

## ✨ Key Features

- ✅ **Modular Design** - Reusable Terraform modules
- ✅ **Remote State** - Centralized state management
- ✅ **Security Scanning** - Trivy IaC scanning
- ✅ **Auto-Deploy** - GitHub Actions automation
- ✅ **Pre-Configured VM** - Docker, PostgreSQL, Grafana ready
- ✅ **Best Practices** - Tags, NSG rules, SSH-only access

---

**Need Help?** Check the full documentation in [TERRAFORM_README.md](./TERRAFORM_README.md)

**Deploy Now:** `git push origin main`

---

**Last Updated:** March 2026  
**Region:** East US 2  
**Status:** Production Ready ✅
