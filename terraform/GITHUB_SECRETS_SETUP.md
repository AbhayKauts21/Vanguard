# GitHub Secrets Setup Guide

This guide explains how to configure GitHub Secrets for the Terraform deployment workflow.

## 🔐 Required Secrets

### 1. AZURE_CREDENTIALS (Required)

The workflow uses Azure CLI login via the `azure/login@v2` action, which requires a single secret named `AZURE_CREDENTIALS`.

### 2. POSTGRES_PASSWORD (Optional but Recommended)

PostgreSQL admin password for database access.

**Default if not set:** `Postgres@123`

**Recommendation:** Set a strong password for production deployments.

---

## 📋 Secret Format

### AZURE_CREDENTIALS

The `AZURE_CREDENTIALS` secret must be a JSON object containing your Azure Service Principal credentials:

```json
{
  "clientId": "<service-principal-client-id>",
  "clientSecret": "<service-principal-client-secret>",
  "subscriptionId": "<azure-subscription-id>",
  "tenantId": "<azure-tenant-id>"
}
```

---

## 📋 Step-by-Step Setup

### Step 1: Create Azure Service Principal

If you haven't already created a Service Principal, create one using Azure CLI:

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "<your-subscription-id>"

# Create Service Principal with Contributor role
az ad sp create-for-rbac \
  --name "vanguard-github-actions" \
  --role Contributor \
  --scopes /subscriptions/<your-subscription-id>/resourceGroups/vanguard \
  --sdk-auth
```

**Output example:**
```json
{
  "clientId": "12345678-1234-1234-1234-123456789abc",
  "clientSecret": "your-client-secret-here",
  "subscriptionId": "87654321-4321-4321-4321-cba987654321",
  "tenantId": "abcdef12-ab12-ab12-ab12-123456abcdef",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

⚠️ **Important:** Copy this output - you'll need it for the next step!

### Step 2: Verify Service Principal

```bash
# Get the Service Principal Object ID
az ad sp list --display-name "vanguard-github-actions" --query "[].{Name:displayName, AppId:appId, ObjectId:id}" -o table

# Verify role assignment
az role assignment list --assignee <client-id> -o table
```

### Step 3: Add Secret to GitHub Repository

1. Navigate to your GitHub repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Value: Paste the entire JSON output from Step 1
6. Click **Add secret**

### Step 4: Add PostgreSQL Password Secret (Optional but Recommended)

For better security, set a custom PostgreSQL password:

1. In **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `POSTGRES_PASSWORD`
4. Value: Enter a strong password (e.g., `MyS3cur3P@ssw0rd!2024`)
5. Click **Add secret**

**Password Configuration Priority:**
- ✅ If `POSTGRES_PASSWORD` secret is set → uses that value
- ⚠️ If not set → uses default: `Postgres@123`

**Password Requirements:**
- Minimum 8 characters (recommended: 16+)
- Mix of uppercase, lowercase, numbers, and symbols
- Avoid common words or patterns

---

## 🔄 Alternative: Using Existing Service Principal

If you already have a Service Principal, retrieve its credentials:

```bash
# Get Service Principal details
APP_ID=$(az ad sp list --display-name "vanguard-github-actions" --query "[0].appId" -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "Client ID: $APP_ID"
echo "Tenant ID: $TENANT_ID"
echo "Subscription ID: $SUBSCRIPTION_ID"
```

⚠️ **Note:** You'll need to reset the client secret if you don't have it:

```bash
# Reset Service Principal credentials
az ad sp credential reset --id $APP_ID --append
```

Create the JSON manually:

```json
{
  "clientId": "<app-id-from-above>",
  "clientSecret": "<new-client-secret>",
  "subscriptionId": "<subscription-id-from-above>",
  "tenantId": "<tenant-id-from-above>"
}
```

---

## ✅ Verify Setup

### Test Locally

Create a temporary file `azure-creds.json` with your credentials and test the login:

```bash
# Export credentials
export AZURE_CREDENTIALS=$(cat azure-creds.json)

# Test Azure CLI login (simulating GitHub Actions)
az login --service-principal \
  -u $(echo $AZURE_CREDENTIALS | jq -r .clientId) \
  -p $(echo $AZURE_CREDENTIALS | jq -r .clientSecret) \
  --tenant $(echo $AZURE_CREDENTIALS | jq -r .tenantId)

# Verify access
az account show
az group show --name vanguard

# Cleanup
rm azure-creds.json
unset AZURE_CREDENTIALS
```

### Test in GitHub Actions

1. Push a change to the `terraform/` directory
2. Check the **Actions** tab in GitHub
3. Monitor the workflow execution
4. Verify the "Azure CLI Login" step succeeds

---

## 🔒 Security Best Practices

### ✅ Do's

- ✅ Store credentials as GitHub secrets (encrypted at rest)
- ✅ Use Service Principal with least privilege (Contributor on Resource Group only)
- ✅ Rotate credentials periodically (every 90 days recommended)
- ✅ Use separate Service Principals for different environments
- ✅ Enable audit logging for the Service Principal
- ✅ Review permissions regularly

### ❌ Don'ts

- ❌ Never commit credentials to source control
- ❌ Don't give Owner role unless absolutely necessary
- ❌ Don't share credentials across multiple projects
- ❌ Don't use personal accounts for automation
- ❌ Don't hardcode secrets in workflow files

---

## 🔄 Credential Rotation

Set up automatic credential rotation (recommended every 90 days):

```bash
# Create new credentials
NEW_CREDS=$(az ad sp credential reset --id $APP_ID --years 1 --append --query '{clientId: appId, clientSecret: password}' -o json)

# Combine with subscription and tenant info
FULL_CREDS=$(echo $NEW_CREDS | jq --arg sub "$SUBSCRIPTION_ID" --arg tenant "$TENANT_ID" \
  '. + {subscriptionId: $sub, tenantId: $tenant}')

echo "Update AZURE_CREDENTIALS secret in GitHub with:"
echo $FULL_CREDS | jq .

# Remove old credentials after verifying new ones work
az ad sp credential delete --id $APP_ID --key-id <old-key-id>
```

---

## 🧪 Troubleshooting

### Error: "Authentication failed"

**Cause:** Invalid or expired credentials

**Solution:**
```bash
# Verify Service Principal exists
az ad sp show --id <client-id>

# Reset credentials
az ad sp credential reset --id <client-id>

# Update GitHub secret
```

### Error: "Insufficient privileges"

**Cause:** Service Principal lacks necessary permissions

**Solution:**
```bash
# Grant Contributor role on Resource Group
az role assignment create \
  --assignee <client-id> \
  --role Contributor \
  --scope /subscriptions/<subscription-id>/resourceGroups/vanguard

# Verify role assignment
az role assignment list --assignee <client-id> -o table
```

### Error: "Resource group not found"

**Cause:** Service Principal doesn't have access to the resource group

**Solution:**
```bash
# Verify resource group exists
az group show --name vanguard

# Check Service Principal can access it
az group show --name vanguard --query id -o tsv
```

### Error: "Invalid JSON in AZURE_CREDENTIALS"

**Cause:** Malformed JSON in the secret

**Solution:**
- Remove any extra whitespace, newlines, or quotes
- Validate JSON using: `echo '<your-json>' | jq .`
- Ensure all required fields are present: clientId, clientSecret, subscriptionId, tenantId
- Copy-paste the exact JSON output from `az ad sp create-for-rbac --sdk-auth`

---

## 📚 Additional Resources

- [Azure CLI Login Action](https://github.com/Azure/login)
- [Azure Service Principal Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Azure RBAC Best Practices](https://docs.microsoft.com/en-us/azure/role-based-access-control/best-practices)

---

## 📋 Quick Reference

| Secret Name | Format | Required Fields |
|------------|--------|----------------|
| `AZURE_CREDENTIALS` | JSON | `clientId`, `clientSecret`, `subscriptionId`, `tenantId` |

### Example Commands

```bash
# Create Service Principal
az ad sp create-for-rbac --name "vanguard-github-actions" --role Contributor --scopes /subscriptions/<sub-id>/resourceGroups/vanguard --sdk-auth

# List Service Principals
az ad sp list --display-name "vanguard-github-actions"

# Reset credentials
az ad sp credential reset --id <client-id>

# Delete Service Principal (cleanup)
az ad sp delete --id <client-id>
```

---

**Last Updated:** March 2026  
**Maintained By:** DevOps Team
