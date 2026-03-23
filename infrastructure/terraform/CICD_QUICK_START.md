# 🚀 Terraform CI/CD Quick Start Guide

## Overview

Your Terraform infrastructure now has **automated CI/CD** via GitHub Actions:

- ✅ **Pull Request** → Runs `terraform plan`, posts plan to PR comments
- ✅ **Merge to Main** → Runs `terraform apply`, deploys infrastructure automatically
- ✅ **Drift Detection** → Optional scheduled check for manual changes

## 🔐 Prerequisites: Service Principal Setup

**BEFORE** you can use GitHub Actions, you MUST create an Azure Service Principal and configure GitHub secrets.

### Step 1: Create Service Principal

```bash
# Login to Azure
az login

# Create Service Principal with Contributor role on vanguard resource group
az ad sp create-for-rbac \
  --name "vanguard-github-actions" \
  --role Contributor \
  --scopes /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard \
  --sdk-auth
```

**Expected output:**
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "0d5505db-c5a0-4a2d-8e52-1ff49cd01a36",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  ...
}
```

**⚠️ COPY THIS ENTIRE JSON OUTPUT - YOU'LL NEED IT!**

### Step 2: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Create these 3 secrets:

| Secret Name | Value | Where to get it |
|-------------|-------|-----------------|
| `AZURE_CREDENTIALS` | **Entire JSON output** from step 1 | Copy the whole JSON |
| `AZURE_TENANT_ID` | `tenantId` value from JSON | Extract from JSON |
| `AZURE_SUBSCRIPTION_ID` | `subscriptionId` from JSON (or use `0d5505db-c5a0-4a2d-8e52-1ff49cd01a36`) | Extract from JSON |

**Example:**
- AZURE_CREDENTIALS: `{"clientId": "xxx", "clientSecret": "xxx", ...}` ← whole thing
- AZURE_TENANT_ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- AZURE_SUBSCRIPTION_ID: `0d5505db-c5a0-4a2d-8e52-1ff49cd01a36`

---

## 🔄 Feature Branch Workflow

### 1️⃣ Create Feature Branch

```bash
# Start from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-storage-account
```

### 2️⃣ Make Terraform Changes

```bash
cd infrastructure/terraform

# Edit Terraform files
vim main.tf

# Example: Add a storage account
cat >> main.tf <<EOF

# Azure Storage Account
resource "azurerm_storage_account" "vanguard_storage" {
  name                     = "vanguardstorage"
  resource_group_name      = data.azurerm_resource_group.vanguard.name
  location                 = data.azurerm_resource_group.vanguard.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags
}
EOF
```

### 3️⃣ Test Locally (Optional but Recommended)

```bash
# Format code
terraform fmt

# Validate
terraform validate

# Plan (requires Azure CLI login)
terraform plan
```

### 4️⃣ Commit and Push

```bash
git add infrastructure/terraform/
git commit -m "Add Azure Storage Account for application data"
git push origin feature/add-storage-account
```

### 5️⃣ Create Pull Request

```bash
# Option 1: Via GitHub CLI (if installed)
gh pr create --title "Add Azure Storage Account" --body "Adds storage account for application data storage"

# Option 2: Via GitHub Web UI
# Go to: https://github.com/YOUR_USERNAME/Vanguard-1/pulls
# Click "New pull request"
```

### 6️⃣ Review Terraform Plan in PR

✅ GitHub Actions will automatically:
1. Run `terraform fmt -check`
2. Run `terraform validate`
3. Run `terraform plan`
4. Post the plan as a **PR comment**

**Example PR Comment:**
```
#### Terraform Format and Style 🖌 success
#### Terraform Initialization ⚙️ success
#### Terraform Validation 🤖 success
#### Terraform Plan 📖 success

Terraform will perform the following actions:
  # azurerm_storage_account.vanguard_storage will be created
  + resource "azurerm_storage_account" "vanguard_storage" {
      + name                     = "vanguardstorage"
      + resource_group_name      = "vanguard"
      ...
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

### 7️⃣ Merge Pull Request

**After reviewing the plan:**

```bash
# Option 1: Via GitHub CLI
gh pr merge --merge

# Option 2: Via GitHub Web UI
# Click "Merge pull request" button
```

### 8️⃣ Automatic Deployment

✅ GitHub Actions will automatically:
1. Run `terraform plan`
2. Run `terraform apply -auto-approve`
3. Deploy your infrastructure to Azure!
4. Post a success comment with Azure Portal link

---

## 📋 Common Workflows

### Check Current Terraform State

```bash
cd infrastructure/terraform
terraform show
terraform state list
```

### View Outputs After Deployment

```bash
# View all outputs
terraform output

# Get specific output
terraform output public_ip_address
terraform output ssh_command
```

### Manual Plan (Local Testing)

```bash
cd infrastructure/terraform
az login  # Use your personal account
terraform plan
```

### Refresh State

```bash
terraform refresh
```

### Destroy Resources (⚠️ CAREFUL!)

```bash
# This will DELETE all infrastructure!
terraform destroy

# For GitHub Actions, you'd need to:
# 1. Create a manual workflow
# 2. Or run locally with terraform destroy
```

---

## 🔍 Monitoring GitHub Actions

### View Workflow Runs

1. Go to: **GitHub Repository** → **Actions** tab
2. Click on **Terraform Infrastructure** workflow
3. See all runs (plan on PRs, apply on merges)

### Check Workflow Status

```bash
# Via GitHub CLI
gh run list --workflow=terraform.yml

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch
```

---

## 🐛 Troubleshooting

### Error: "Azure Login failed"

**Problem:** GitHub doesn't have Azure credentials

**Solution:**
1. Verify `AZURE_CREDENTIALS` secret exists
2. Check JSON is valid (use a JSON validator)
3. Ensure Service Principal still exists: `az ad sp list --display-name "vanguard-github-actions"`

### Error: "Terraform Init failed"

**Problem:** Backend configuration issue

**Solution:**
1. Check terraform version in workflow matches your local
2. Verify `infrastructure/terraform` directory exists in repository

### Error: "The client does not have authorization"

**Problem:** Service Principal doesn't have permissions

**Solution:**
```bash
# Re-assign Contributor role
az role assignment create \
  --assignee <SP_CLIENT_ID> \
  --role Contributor \
  --scope /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard
```

### Plan Shows Unexpected Changes

**Problem:** Someone modified resources manually in Azure Portal

**Solution:**
1. Review the plan carefully
2. Either:
   - Accept changes (merge PR to apply)
   - Or fix drift by reverting manual changes in Azure

---

## 📚 Additional Resources

- **Detailed SP Setup:** See [infrastructure/terraform/AZURE_SP_SETUP.md](infrastructure/terraform/AZURE_SP_SETUP.md)
- **Terraform README:** See [infrastructure/terraform/README.md](infrastructure/terraform/README.md)
- **Workflow File:** See [.github/workflows/terraform.yml](.github/workflows/terraform.yml)

---

## ✅ Checklist Before First Deployment

- [ ] Azure Service Principal created
- [ ] GitHub secrets configured:
  - [ ] `AZURE_CREDENTIALS`
  - [ ] `AZURE_TENANT_ID`
  - [ ] `AZURE_SUBSCRIPTION_ID`
- [ ] SSH key exists at `~/.ssh/id_rsa.pub` (or updated path in `terraform.tfvars`)
- [ ] Tenant ID set in `terraform/terraform.tfvars`
- [ ] Reviewed `terraform/variables.tf` defaults
- [ ] Resource group `vanguard` exists in Azure

---

## 🎯 Quick Command Reference

```bash
# Create Service Principal
az ad sp create-for-rbac --name "vanguard-github-actions" \
  --role Contributor \
  --scopes /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard \
  --sdk-auth

# Test SP Login
az login --service-principal -u <CLIENT_ID> -p <CLIENT_SECRET> --tenant <TENANT_ID>

# List Resources
az resource list --resource-group vanguard --output table

# Create Feature Branch
git checkout -b feature/my-infrastructure-change

# Create PR
gh pr create --title "My Change" --body "Description"

# Merge PR
gh pr merge --merge

# Watch Workflow
gh run watch
```

---

**Ready to deploy?** 🚀

1. Create Service Principal ✓
2. Set GitHub Secrets ✓
3. Push to feature branch ✓
4. Create PR ✓
5. Review plan ✓
6. Merge → **Auto-deploy!** ✨
