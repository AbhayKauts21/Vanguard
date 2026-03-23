# Azure Service Principal Setup for Terraform

This guide explains how to create and configure an Azure Service Principal for Terraform automation, both locally and in GitHub Actions.

## 📋 Prerequisites

- Azure CLI installed (`az --version`)
- Logged into Azure (`az login`)
- Permissions to create Service Principals in your Azure AD tenant
- Owner or User Access Administrator role on the subscription

## 🔐 Understanding Service Principals

A **Service Principal (SP)** is an identity created for use with applications, hosted services, and automated tools to access Azure resources. Think of it as a "service account" for non-human authentication.

### Why Use a Service Principal?

1. **Security**: No need to use personal credentials in automation
2. **RBAC**: Can be assigned specific roles/permissions
3. **Auditing**: Actions are tracked separately from user accounts
4. **Automation**: Credentials can be stored securely in CI/CD systems

## 🚀 Quick Setup

### Option 1: Using Azure CLI (Recommended)

```bash
# 1. Login to Azure
az login

# 2. Set your subscription (if you have multiple)
az account set --subscription "0d5505db-c5a0-4a2d-8e52-1ff49cd01a36"

# 3. Create Service Principal with Contributor role on vanguard resource group
az ad sp create-for-rbac \
  --name "vanguard-github-actions" \
  --role Contributor \
  --scopes /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard \
  --sdk-auth
```

### Expected Output

```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "0d5505db-c5a0-4a2d-8e52-1ff49cd01a36",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**⚠️ SAVE THIS OUTPUT SECURELY - You cannot retrieve the `clientSecret` again!**

### Option 2: Manual Creation (Azure Portal)

1. **Go to Azure Active Directory** → **App registrations** → **New registration**
2. Name: `vanguard-github-actions`
3. Supported account types: **Single tenant**
4. Click **Register**
5. Note the **Application (client) ID** and **Directory (tenant) ID**
6. Go to **Certificates & secrets** → **New client secret**
7. Add description, set expiry (recommended: 12-24 months), click **Add**
8. **IMMEDIATELY COPY THE SECRET VALUE** (you can't see it again!)
9. Go to **Subscriptions** → Select your subscription → **Access control (IAM)**
10. Click **Add role assignment**
11. Role: **Contributor**
12. Scope: **Resource group** → Select `vanguard`
13. Assign access to: **User, group, or service principal**
14. Select your app registration
15. Click **Save**

## 🛠️ Local Development Setup

For running Terraform locally with the Service Principal:

### Method 1: Environment Variables

```bash
# Create a .env file (DO NOT COMMIT THIS!)
cat > terraform/.env.azure <<EOF
export ARM_CLIENT_ID="your-client-id"
export ARM_CLIENT_SECRET="your-client-secret"
export ARM_SUBSCRIPTION_ID="0d5505db-c5a0-4a2d-8e52-1ff49cd01a36"
export ARM_TENANT_ID="your-tenant-id"
EOF

# Source the file before running Terraform
source terraform/.env.azure

# Run Terraform
cd terraform
terraform init
terraform plan
```

### Method 2: Azure CLI Login (Easier for Local Dev)

```bash
# Use your personal account for local development
az login

# Terraform will automatically use your Azure CLI session
cd terraform
terraform init
terraform plan
```

**Recommendation**: Use Method 2 for local dev, Method 1 for automation/CI/CD.

## 🔧 GitHub Actions Setup

### Step 1: Get Service Principal Credentials

Run the Azure CLI command from "Quick Setup" above and copy the entire JSON output.

### Step 2: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Create these secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AZURE_CREDENTIALS` | Entire JSON output from SP creation | `{"clientId": "...", "clientSecret": "...", ...}` |
| `AZURE_TENANT_ID` | Tenant ID from JSON output | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID (or use default) | `0d5505db-c5a0-4a2d-8e52-1ff49cd01a36` |

### Step 3: Verify Workflow

The GitHub Actions workflow (`.github/workflows/terraform.yml`) will now:

1. **On Pull Request**: Run `terraform plan` and comment the plan on the PR
2. **On Merge to Main**: Run `terraform apply` to deploy infrastructure

## 🔍 Verifying Service Principal

### Check SP exists
```bash
az ad sp list --display-name "vanguard-github-actions" --output table
```

### Check SP role assignments
```bash
az role assignment list \
  --assignee <client-id-from-previous-command> \
  --scope /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard \
  --output table
```

### Test SP authentication
```bash
az login --service-principal \
  -u <client-id> \
  -p <client-secret> \
  --tenant <tenant-id>

# List resources in the vanguard resource group
az resource list --resource-group vanguard --output table
```

## 🔄 Workflow Example

### Feature Branch Development

```bash
# 1. Create feature branch
git checkout -b feature/add-storage-account

# 2. Make Terraform changes
cd terraform
# ... edit main.tf ...

# 3. Commit and push
git add .
git commit -m "Add Azure Storage Account"
git push origin feature/add-storage-account

# 4. Create Pull Request
# GitHub Actions will automatically run `terraform plan`
# and comment the plan on your PR

# 5. Review the plan in the PR comments

# 6. Merge PR
# GitHub Actions will automatically run `terraform apply`
# Infrastructure is deployed!
```

## 🔐 Security Best Practices

### 1. Principle of Least Privilege
- ✅ Service Principal scoped to **vanguard resource group only**
- ✅ Role assigned: **Contributor** (can create/modify resources but not manage access)
- ❌ Avoid giving **Owner** role unless absolutely necessary

### 2. Secret Rotation
- Rotate client secrets every 6-12 months
- Set expiry dates on secrets
- Update GitHub secrets when rotating

```bash
# Create new secret for existing SP
az ad sp credential reset \
  --name "vanguard-github-actions" \
  --years 1
```

### 3. Audit Logging
- Monitor SP activity in Azure Activity Log
- Set up alerts for suspicious activity

```bash
# View recent activity by SP
az monitor activity-log list \
  --caller <client-id> \
  --start-time 2026-03-20T00:00:00Z \
  --output table
```

### 4. Separate SPs per Environment
For production setups, consider:
- `vanguard-github-actions-dev` → dev resource group
- `vanguard-github-actions-staging` → staging resource group  
- `vanguard-github-actions-prod` → prod resource group

## 🐛 Troubleshooting

### Error: "The client with object id does not have authorization"

**Cause**: Service Principal doesn't have permissions on the resource group.

**Solution**:
```bash
az role assignment create \
  --assignee <client-id> \
  --role Contributor \
  --scope /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard
```

### Error: "invalid_client - AADSTS7000215: Invalid client secret"

**Cause**: Client secret is incorrect or expired.

**Solution**: Reset the secret and update GitHub secrets:
```bash
az ad sp credential reset --name "vanguard-github-actions"
```

### Error: "AADSTS700016: Application with identifier was not found"

**Cause**: Service Principal was deleted or doesn't exist.

**Solution**: Create a new Service Principal using the Quick Setup steps.

### GitHub Actions showing "Azure Login failed"

**Cause**: `AZURE_CREDENTIALS` secret is malformed or missing fields.

**Solution**:
1. Verify JSON format is correct
2. Ensure all required fields are present: `clientId`, `clientSecret`, `subscriptionId`, `tenantId`
3. Recreate the secret if needed

## 📚 Additional Resources

- [Azure Service Principal Documentation](https://docs.microsoft.com/azure/active-directory/develop/app-objects-and-service-principals)
- [Terraform Azure Provider Authentication](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/guides/service_principal_client_secret)
- [GitHub Actions Azure Login](https://github.com/marketplace/actions/azure-login)

## 📝 Quick Reference Commands

```bash
# Create SP
az ad sp create-for-rbac --name "vanguard-github-actions" \
  --role Contributor \
  --scopes /subscriptions/0d5505db-c5a0-4a2d-8e52-1ff49cd01a36/resourceGroups/vanguard \
  --sdk-auth

# List SPs
az ad sp list --display-name "vanguard-github-actions"

# Reset SP secret
az ad sp credential reset --name "vanguard-github-actions"

# Delete SP (if needed)
az ad sp delete --id <client-id>

# Test SP login
az login --service-principal -u <client-id> -p <secret> --tenant <tenant-id>

# Check role assignments
az role assignment list --assignee <client-id> --output table
```

---

**Tenant**: ANDINO GLOBAL TECH PRIVATE LIMITED  
**Subscription**: 0d5505db-c5a0-4a2d-8e52-1ff49cd01a36  
**Resource Group**: vanguard
