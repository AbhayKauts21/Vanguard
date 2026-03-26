# 02 — Getting Started

---

# CheckingMate Installation Guide

## System Requirements

### Hardware

- **Minimum RAM**: 4 GB (8 GB recommended for running all Docker services alongside the application)
- **Minimum Disk Space**: 10 GB (Go toolchain + Docker images + database volumes)
- **Recommended CPU**: 2+ cores for concurrent build and test execution

### Software

| Software | Required Version | Purpose |
|----------|-----------------|---------|
| **Go** | 1.24.4 or later | Primary language runtime |
| **Docker** | 20.x+ | Container runtime for dependencies |
| **Docker Compose** | v2.x+ | Orchestrates local development services |
| **Just** | Latest | Task runner (recommended, not required) |
| **Git** | 2.x+ | Version control |

### Optional Development Tools

| Tool | Purpose | Installation |
|------|---------|-------------|
| **golangci-lint** | Code linting | `just install-deps` |
| **wire** | Compile-time DI code generation | `just install-deps` |
| **mockgen** | Test mock generation | `just install-deps` |
| **arch-go** | Architecture dependency validation | `just install-deps` |

## Pre-Installation Checklist

- [ ] Go 1.24.4+ installed and `go version` returns correct version
- [ ] Docker Desktop or Docker Engine running
- [ ] Docker Compose v2 available (`docker compose version`)
- [ ] Git installed and repository access configured
- [ ] (Optional) Just command runner installed (`brew install just` on macOS)

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd checkingmatev2-backend
```

### Step 2: Install Go Dependencies

```bash
go mod download
```

This downloads all Go module dependencies defined in `go.mod`, including the MongoDB driver, OpenTelemetry SDK, Ginkgo testing framework, Wire, and all other libraries.

### Step 3: Install Development Tools (Optional)

```bash
just install-deps
```

This installs:
- `golangci-lint` for code linting
- `wire` for dependency injection code generation
- `mockgen` for generating test mocks
- `arch-go` for architecture validation

If you don't have Just installed, install these tools manually:

```bash
go install github.com/google/wire/cmd/wire@latest
go install go.uber.org/mock/mockgen@latest
```

### Step 4: Generate Wire DI Code

```bash
just wire
```

Or manually:

```bash
cd cmd/api/wire && wire && cd ../../..
```

This generates `cmd/api/wire/wire_gen.go`, which contains the compile-time dependency injection wiring for all modules.

### Step 5: Start Docker Compose Services

```bash
docker compose up -d
```

This starts the following services:

| Service | Port | Purpose |
|---------|------|---------|
| MongoDB 8.0 | 27017 | Primary database |
| MariaDB 11 | 3306 | Saffer module database |
| Redis 7 | 6379 | Caching and distributed locking |
| OTel Collector | 4317 (gRPC), 4318 (HTTP) | Telemetry data collection |
| Prometheus | 9091 | Metrics storage |
| Loki | 3100 | Log aggregation |

### Step 6: Build the Application

```bash
just build
# or
go build -o api cmd/api/main.go
```

### Step 7: Run the Application

```bash
./api
```

Or use the all-in-one command:

```bash
just run
```

The `just run` command builds the application, starts Docker Compose services, loads Mountebank imposters for API mocking, and starts the server.

## Verification

### Health Check

```bash
curl http://localhost:8000/healthz
```

Expected response: `200 OK` with a health status JSON body.

### Verify Database Connectivity

Check the application logs for successful MongoDB connection:

```
level=INFO msg="connected to MongoDB" database=checkingmate
```

### Verify OpenTelemetry

Check that the OTel collector is receiving data:

```bash
docker compose logs otel-collector
```

## Troubleshooting Installation

### Problem: `wire` command not found

**Solution**: Ensure `$GOPATH/bin` is in your `$PATH`:

```bash
export PATH=$PATH:$(go env GOPATH)/bin
```

### Problem: Docker services fail to start

**Solution**: Check for port conflicts:

```bash
lsof -i :27017  # MongoDB
lsof -i :6379   # Redis
lsof -i :3306   # MariaDB
```

Stop conflicting services or modify ports in `compose.yaml`.

### Problem: Build fails with missing `wire_gen.go`

**Solution**: Run `just wire` to generate the Wire DI code before building.

### Problem: MongoDB connection refused

**Solution**: Ensure Docker Compose is running and wait for the health check to pass:

```bash
docker compose ps
# MongoDB should show "healthy" status
```

---

# CheckingMate Quick Start Tutorial

## Scenario: Create a Template, Assign it, and Submit a Form in 10 Minutes

This tutorial walks you through the core workflow: creating a checklist template, assigning it to a worker, and submitting a completed form.

## Prerequisites

- CheckingMate backend running (see [Installation Guide](#checkingmate-installation-guide))
- A valid JWT token from the Angelis Auth API (or use Mountebank mocks for local development)
- `curl` or an HTTP client (Postman, Insomnia, etc.)

## Step-by-Step

### Step 1: Verify the API is Running

```bash
curl http://localhost:8000/healthz
```

Expected output: `200 OK`

### Step 2: Create a Template

```bash
curl -X POST http://localhost:8000/v1/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Fire Safety Inspection",
    "description": "Daily fire safety checklist",
    "scoring_enabled": true,
    "notify_supervisor": true
  }'
```

Expected response: `201 Created` with the template object including an `id` field. The template starts in `Draft` status.

Note the returned `template_id` — you will need it for the following steps.

### Step 3: Add Sections and Questions

First, add a section:

```bash
curl -X POST http://localhost:8000/v1/templates/{template_id}/sections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "Fire Equipment"}'
```

Then add a question (note the `section_id` from the response):

```bash
curl -X POST http://localhost:8000/v1/templates/{template_id}/sections/{section_id}/questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Is the fire extinguisher present and accessible?",
    "type": "boolean",
    "required": true,
    "anomalous_responses": ["false"],
    "follow_up_actions": ["request_comment", "create_finding"]
  }'
```

### Step 4: Activate the Template

```bash
curl -X PATCH http://localhost:8000/v1/templates/{template_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "Active"}'
```

### Step 5: Create an Assignment

```bash
curl -X POST http://localhost:8000/v1/assignments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "template_id": "{template_id}",
    "worker_id": "{worker_profile_id}",
    "start_date_time": "2026-03-23T08:00:00Z",
    "submission_window": "8h"
  }'
```

### Step 6: Submit a Form

```bash
curl -X POST http://localhost:8000/v1/forms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "template_id": "{template_id}",
    "template_version": 1,
    "assignment_id": "{assignment_id}",
    "sections": [
      {
        "id": "{section_id}",
        "name": "Fire Equipment",
        "position": 1,
        "questions": [
          {
            "id": "{question_id}",
            "text": "Is the fire extinguisher present and accessible?",
            "type": "boolean",
            "required": true,
            "position": 1,
            "answer": {
              "value": true
            }
          }
        ]
      }
    ],
    "signature": {
      "type": "image",
      "value": "data:image/png;base64,..."
    }
  }'
```

### Step 7: Generate a PDF Report

```bash
curl http://localhost:8000/v1/forms/{form_id}/generate-pdf?tz=America/New_York \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output form-report.pdf
```

## Verify Success

- The form response should include `status: "submitted"` (or `"pending_for_approval"` if supervisor signatures are required).
- The assignment status should transition from `pending` to `completed`.
- If an anomalous answer was given, check `GET /v1/findings` for an automatically created finding.

## Next Steps

- [Core Features](./03-core-features.md): Learn about templates, assignments, findings, and scoring in detail.
- [API Reference](./04-api-reference.md): Complete endpoint catalog with all parameters and examples.
- [Troubleshooting](./06-troubleshooting-and-faq.md): Common issues and solutions.

---

# CheckingMate Environment Setup

## Environment Variables

CheckingMate uses Viper for configuration loading. Values are read from `config/api.yaml` first, then overridden by environment variables prefixed with `CHECKING_MATE_`. Nested keys use underscores as separators.

### Required Variables

| Variable | Description | Type | Default | Example |
|----------|------------|------|---------|---------|
| `CHECKING_MATE_MONGODB_URI` | MongoDB connection string | string | `mongodb://localhost:27017` | `mongodb://user:pass@host:27017` |
| `CHECKING_MATE_MONGODB_DATABASE` | MongoDB database name | string | `checkingmate` | `checkingmate_prod` |
| `CHECKING_MATE_SERVER_PORT` | HTTP server port | integer | `8000` | `8080` |
| `CHECKING_MATE_ANGELIS_BASE_URL` | Angelis Auth API base URL | string | `https://test.dev.angelis.ai` | `https://auth.example.com` |

### Optional Variables

| Variable | Description | Default |
|----------|------------|---------|
| `CHECKING_MATE_GENERAL_LOG_LEVEL` | Logging level (debug, info, warn, error) | `debug` |
| `CHECKING_MATE_MODULES_CHECKING_ENABLED` | Enable checking module | `true` |
| `CHECKING_MATE_MODULES_SAFFER_ENABLED` | Enable saffer module | `false` |
| `CHECKING_MATE_MODULES_CONTROL_PLANE_ENABLED` | Enable control plane module | `false` |
| `CHECKING_MATE_MODULES_CONTROL_PLANE_API_KEY` | API key for control plane | none |
| `CHECKING_MATE_OTEL_ENABLED` | Enable OpenTelemetry | `true` |
| `CHECKING_MATE_OTEL_ENDPOINT` | OTel collector endpoint | `localhost:4317` |
| `CHECKING_MATE_OTEL_SERVICE_NAME` | Service name for telemetry | `checkingmatev2-backend` |
| `CHECKING_MATE_OTEL_ENVIRONMENT` | Environment label | `development` |
| `CHECKING_MATE_MYSQL_URI` | MySQL connection string (Saffer) | `saffer:saffer@tcp(localhost:3306)` |
| `CHECKING_MATE_MYSQL_DATABASE` | MySQL database name (Saffer) | `saffer` |
| `CHECKING_MATE_REDIS_ADDR` | Redis address | `localhost:6379` |
| `CHECKING_MATE_REDIS_TLS_ENABLED` | Enable TLS for Redis | `false` |
| `CHECKING_MATE_SENDGRID_API_KEY` | SendGrid API key for emails | `dummy` |
| `CHECKING_MATE_SENDGRID_FROM_EMAIL` | Sender email address | `noreply@angelis.ai` |
| `CHECKING_MATE_AZURE_STORAGE_ACCOUNT_NAME` | Azure Blob account name | `checkingmateblob` |
| `CHECKING_MATE_AZURE_STORAGE_ACCOUNT_KEY` | Azure Blob account key | base64-encoded key |
| `CHECKING_MATE_AZURE_STORAGE_CONTAINER_NAME` | Azure Blob container | `storage-dev` |
| `CHECKING_MATE_WORKER_ASSIGNMENT_INTERVAL` | Assignment worker poll interval | `5m` |
| `CHECKING_MATE_SERVER_ADMIN_BASE_URL` | Admin UI base URL (for email links) | `http://localhost:3000` |
| `CHECKING_MATE_SERVER_API_BASE_URL` | Public API base URL | `http://localhost:8000` |

## Development Environment

Create a `.env` file in the project root (or use `direnv` with the provided `.envrc`):

```bash
# .env.development
CHECKING_MATE_GENERAL_LOG_LEVEL=debug
CHECKING_MATE_SERVER_PORT=8000
CHECKING_MATE_MONGODB_URI=mongodb://localhost:27017
CHECKING_MATE_MONGODB_DATABASE=checkingmate
CHECKING_MATE_ANGELIS_BASE_URL=http://localhost:2526
CHECKING_MATE_OTEL_ENABLED=true
CHECKING_MATE_OTEL_ENDPOINT=localhost:4317
CHECKING_MATE_REDIS_ADDR=localhost:6379
CHECKING_MATE_MODULES_CHECKING_ENABLED=true
CHECKING_MATE_MODULES_SAFFER_ENABLED=true
CHECKING_MATE_MODULES_CONTROL_PLANE_ENABLED=true
```

## Production Environment

```bash
# .env.production
CHECKING_MATE_GENERAL_LOG_LEVEL=info
CHECKING_MATE_SERVER_PORT=8000
CHECKING_MATE_MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net
CHECKING_MATE_MONGODB_DATABASE=checkingmate_prod
CHECKING_MATE_ANGELIS_BASE_URL=https://auth.production.example.com
CHECKING_MATE_OTEL_ENABLED=true
CHECKING_MATE_OTEL_ENDPOINT=otel-collector.internal:4317
CHECKING_MATE_OTEL_ENVIRONMENT=production
CHECKING_MATE_REDIS_ADDR=redis.internal:6379
CHECKING_MATE_REDIS_TLS_ENABLED=true
CHECKING_MATE_SENDGRID_API_KEY=SG.your-actual-key
# IMPORTANT: Never commit production secrets to version control
```

> [!CAUTION]
> Never commit `.env` files containing production secrets. Use a secrets manager (e.g., Azure Key Vault, AWS Secrets Manager) for production deployments.

## Configuration Validation

After starting the application, verify configuration by checking the startup logs:

```bash
./api 2>&1 | head -20
```

Look for successful connection messages to MongoDB, Redis, and the OTel Collector.

---

# CheckingMate Initial Configuration

## First-Time Setup

### 1. Database Initialization

Run database migrations to set up indexes and initial data:

```bash
just migrate
```

This builds the migration tool (`cmd/migration/`), starts Docker Compose services, and runs all pending migrations against MongoDB.

### 2. Module Configuration

The system has three optional modules controlled via configuration:

| Module | Config Key | Default | Purpose |
|--------|-----------|---------|---------|
| **checking** | `CHECKING_MATE_MODULES_CHECKING_ENABLED` | `true` | Core checklist functionality |
| **saffer** | `CHECKING_MATE_MODULES_SAFFER_ENABLED` | `false` | Testing/assessment system |
| **control_plane** | `CHECKING_MATE_MODULES_CONTROL_PLANE_ENABLED` | `false` | Runtime configuration management |

Enable modules by setting the corresponding environment variable to `true`. The control plane module additionally requires `CHECKING_MATE_MODULES_CONTROL_PLANE_API_KEY` to be set.

### 3. Tenant Configuration

Each organization (tenant/client) can configure:

- **Timezone**: Used for daily assignment expiry calculations and email scheduling (e.g., `America/New_York`, `Europe/London`, `Asia/Kolkata`).
- **Cross-Supervisor Assignment**: When enabled, managers can assign tasks to workers across different supervisors.
- **Daily Expiry Email**: Configurable email digest for expiring assignments, with a customizable digest time (HH:MM format).
- **Finding Notifications**: Toggle email notifications for new findings, with optional supervisor notification and custom recipient emails.

Use the tenant config API to configure:

```bash
curl -X PATCH http://localhost:8000/v1/tenant-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -d '{
    "timezone": "America/New_York",
    "cross_supervisor_assignment_enabled": true,
    "daily_expiry_email": {
      "enabled": true,
      "digest_time": "08:00"
    }
  }'
```

> [!IMPORTANT]
> Only users with the **Manager** role can update tenant configuration. Supervisor and worker roles will receive a `403 Forbidden` response.

### 4. External Integration Setup

- **Angelis Auth API**: Configure `CHECKING_MATE_ANGELIS_BASE_URL` to point to your Angelis instance. All authentication is delegated to this service.
- **Azure Blob Storage**: Set the `AZURE_STORAGE_*` environment variables for file upload functionality (form multimedia evidence and signatures).
- **SendGrid**: Set `CHECKING_MATE_SENDGRID_API_KEY` for email notifications.

### 5. Security Hardening

- Set `CHECKING_MATE_GENERAL_LOG_LEVEL=info` in production (avoid `debug` level which may log sensitive data).
- Enable TLS for Redis connections in production (`CHECKING_MATE_REDIS_TLS_ENABLED=true`).
- Use MongoDB connection strings with authentication and TLS.
- Rotate the control plane API key regularly.
- Use HTTPS termination at the load balancer/reverse proxy level.
