# 07 — Security, Compliance & Administration

---

# Security Architecture

## Authentication Model

CheckingMate implements a **delegated authentication** model. The system does not store user credentials or manage authentication flows directly. Instead, all authentication is delegated to the **Angelis Auth API**, an external identity provider.

### Authentication Flow

```
┌───────────┐         ┌────────────────┐         ┌──────────────────┐
│  Client   │────1───▶│  Angelis Auth  │         │  CheckingMate    │
│  App      │◀───2────│  API           │         │  Backend         │
│           │────3────────────────────────────────▶│                 │
│           │◀───4──────────────────────────────── │                 │
└───────────┘         └────────────────┘         └──────────────────┘

1. Client authenticates with Angelis (username/password, OAuth, etc.)
2. Angelis returns JWT token
3. Client sends API request with JWT Bearer Token
4. CheckingMate validates token and processes the request
```

### JWT Token Processing

The middleware chain processes every incoming request:

1. **JWT Middleware**: Extracts and validates the JWT token from the `Authorization` header.
2. **Actor Middleware**: Parses the validated token to create an `Actor` object containing `ClientID` (tenant identifier) and `ProfileID` (user identifier). This actor is stored in the request context.
3. **Request Processing**: Controllers retrieve the actor from context and pass it to service methods for authorization checks.

### Token Structure

The JWT token contains claims that identify the user and their tenant:

```json
{
  "sub": "user-profile-uuid",
  "client_id": "tenant-organization-uuid",
  "iat": 1710505200,
  "exp": 1710508800
}
```

## Authorization Model

Authorization in CheckingMate is **role-based** with **hierarchical enforcement**:

### Roles

| Role | Permissions |
|------|------------|
| **Worker** | Submit forms, view own assignments and forms |
| **Supervisor** | All worker permissions + create templates, manage assignments, manage findings, review forms, view workers' data |
| **Manager** | All supervisor permissions + configure tenant settings, view all data across supervisors, manage cross-supervisor assignments |

### Hierarchical Validation

Before performing certain operations (creating assignments, viewing data), the system validates the organizational hierarchy through the Angelis Auth API:

- **Supervisor → Worker**: A supervisor can only assign tasks to and view data from workers who directly report to them. This check uses `AngelisClient.GetWorkersByProfileID()`.
- **Manager → Supervisor**: A manager has visibility over all supervisors and their workers within the organization.
- **Cross-Supervisor**: When enabled in tenant config, managers can assign workers across different supervisor reporting chains.

### Endpoint-Level Authorization

```go
// Example: Only supervisors and managers can list findings
func (c *FindingController) listFindings() http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        actor := GetActorFromContext(r)
        if !c.isSupervisorOrManager(r.Context(), *actor) {
            httpserver.ReplyWithProblem(w, http.StatusForbidden,
                "only supervisors and managers can access this endpoint")
            return
        }
        // ... process request
    }
}
```

## Multi-Tenant Data Isolation

All data operations are scoped to the authenticated user's `ClientID`:

1. **Repository Level**: Every repository query includes a `client_id` filter derived from the actor's `ClientID`.
2. **Document Level**: All MongoDB documents include a `client_id` field.
3. **Index Level**: Database indexes include `client_id` as a prefix for efficient tenant-scoped queries.

This ensures that tenants cannot access each other's data, even if a query contains a valid document ID from another tenant.

## Network Security

### HTTPS/TLS

CheckingMate serves HTTP on the configured port. **TLS termination should be handled by a reverse proxy or load balancer** (e.g., nginx, HAProxy, Azure Application Gateway) in production environments.

### Redis TLS

For production environments, enable TLS for Redis connections:

```
CHECKING_MATE_REDIS_TLS_ENABLED=true
```

### MongoDB TLS

Use MongoDB connection strings with TLS for production:

```
mongodb+srv://user:password@cluster.mongodb.net/?tls=true
```

## Secrets Management

### Environment Variable Security

- **Never commit** `.env` files, API keys, or database credentials to version control.
- Use a secrets manager (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault) in production.
- The `.gitignore` excludes `.env` files from version control.

### Sensitive Configuration Keys

| Key | Sensitivity | Recommendation |
|-----|------------|---------------|
| `CHECKING_MATE_MONGODB_URI` | High | Use secrets manager; enable auth + TLS |
| `CHECKING_MATE_SENDGRID_API_KEY` | High | Use secrets manager |
| `CHECKING_MATE_AZURE_STORAGE_ACCOUNT_KEY` | High | Use secrets manager or managed identity |
| `CHECKING_MATE_MODULES_CONTROL_PLANE_API_KEY` | High | Rotate regularly |
| `CHECKING_MATE_REDIS_ADDR` | Medium | Use internal networking |
| `CHECKING_MATE_ANGELIS_BASE_URL` | Low | Can be in config files |

---

# Data Management

## Database Schema

### MongoDB Collections (Checking Module)

| Collection | Document Type | Key Indexes |
|-----------|--------------|-------------|
| `templates` | FormTemplate | `client_id + name + version` (unique) |
| `forms` | Form | `client_id + assignment_id`, `client_id + worker_id` |
| `assignments` | Assignment | `client_id + worker_id + status`, `client_id + start_date_time` |
| `recurring_assignments` | RecurringAssignment | `client_id + worker_id` |
| `daily_multi_submission_assignments` | DMSA | `client_id + worker_id` |
| `findings` | Finding | `client_id + form_id`, `client_id + status` |
| `audit_logs` | AuditLog | `client_id + created_at` |
| `tenant_configs` | TenantConfig | `client_id` (unique) |

### MySQL Tables (Saffer Module)

| Table | Purpose |
|-------|---------|
| `test_definitions` | Saffer test definitions |
| `reaction_results` | Reaction time test results |
| `test_results` | Processed test results |

## Backup Strategy

### MongoDB

- Use MongoDB's built-in backup tools: `mongodump` / `mongorestore`.
- For managed services (Atlas), use automated point-in-time backups.
- **Recommended frequency**: Daily full backups + continuous oplog backup.

### MariaDB (Saffer)

- Use `mysqldump` for logical backups.
- For managed services, use provider-specific backup tools.

## Data Retention

- **Audit logs**: Retained indefinitely by default. Consider implementing a TTL index for automatic cleanup of old entries.
- **Forms and findings**: Retained indefinitely as they form the compliance audit trail.
- **Deleted assignments**: Soft-deletion is recommended but not currently implemented; hard-deleted records are gone.

---

# Administration Guide

## User Management

User management is handled entirely through the **Angelis Auth API**. CheckingMate does not create, modify, or delete user accounts. User roles, organizational hierarchy, and reporting relationships are all managed in Angelis.

### Adding a New Organization (Tenant)

1. Create the organization in Angelis.
2. Add users with appropriate roles (Manager, Supervisor, Worker).
3. Set up the reporting hierarchy (supervisors → workers).
4. The first API request from any user in the organization will automatically create a default tenant configuration.

### Managing User Roles

User roles are stored in Angelis. To change a user's role (e.g., promote a Worker to Supervisor), update their profile in Angelis.

## Monitoring & Alerting

### Health Check Endpoint

```bash
# Basic health check
curl http://localhost:8000/healthz
```

### Key Metrics (Prometheus)

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | HTTP request latency by route |
| `http_requests_total` | Counter | Total HTTP requests by route and status |
| `mongodb_operation_duration_seconds` | Histogram | MongoDB operation latency |

### Recommended Alerts

| Alert | Condition | Severity |
|-------|----------|----------|
| API High Latency | p95 > 500ms for 5min | Warning |
| API Error Rate | 5xx rate > 1% for 5min | Critical |
| MongoDB Connection Failures | Connection errors > 0 for 2min | Critical |
| Redis Unavailable | Connection errors > 0 for 5min | Warning |

### Log Aggregation

Logs are exported via the OTel Collector to Loki. Use Grafana to query and visualize log data.

Example Loki query for error logs:

```
{service_name="checkingmatev2-backend"} |= "level=ERROR"
```

## Module Management

### Enabling/Disabling Modules

Modules can be enabled or disabled at startup via configuration:

```yaml
# config/api.yaml
modules:
  checking:
    enabled: true
  saffer:
    enabled: false  # Disable Saffer module
  controlPlane:
    enabled: false
    apiKey: ""
```

When a module is disabled, its controllers are not registered, and its Wire providers are skipped. This reduces memory footprint and startup time.

### Control Plane API Key

The control plane module requires an API key for authentication (separate from JWT):

```
CHECKING_MATE_MODULES_CONTROL_PLANE_API_KEY=your-secure-api-key-here
```

Requests to control plane endpoints must include:

```
X-API-Key: your-secure-api-key-here
```

## Operational Runbook

### Deploying a New Version

1. Run CI/CD pipeline (Drone CI) which builds, tests, and pushes the Docker image.
2. Deploy the new Docker image to your container orchestrator.
3. Run database migrations if needed: `just migrate`.
4. Verify health check: `GET /healthz`.
5. Monitor error rate and latency for 15 minutes post-deployment.

### Database Migration

```bash
# Build the migration tool
just build-migration

# Run migrations (requires Docker Compose services running)
just migrate
```

Migrations are idempotent and can be run multiple times safely.

### Emergency: Roll Back a Deployment

1. Revert to the previous container image version.
2. Verify database compatibility (migrations are forward-only; data schema changes may require manual rollback).
3. Monitor health check and error rate.

### Emergency: Database Recovery

1. Stop the application to prevent further writes.
2. Restore from the latest backup: `mongorestore --uri=$MONGODB_URI --archive=backup.gz --gzip`.
3. Verify data integrity by checking document counts and running key queries.
4. Restart the application.
5. Monitor for data consistency issues.
