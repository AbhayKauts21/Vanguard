# 05 — Development Guide

---

# CheckingMate Project Structure

## Directory Layout

The project follows a **clean architecture** with domain-driven design principles. Below is the annotated directory structure:

```
checkingmatev2-backend/
│
├── cmd/                              # Application entry points
│   ├── api/
│   │   ├── main.go                   # HTTP server bootstrap
│   │   └── wire/                     # Wire dependency injection
│   │       ├── checking.go           # Checking module providers
│   │       ├── saffer.go             # Saffer module providers
│   │       ├── control_plane.go      # Control plane providers
│   │       ├── wire.go               # Main injector definition
│   │       └── wire_gen.go           # Generated (do not edit)
│   └── migration/
│       └── main.go                   # Database migration tool
│
├── internal/                         # Private application code
│   ├── checking/                     # Primary domain module
│   │   ├── domain/                   # Pure business logic
│   │   │   ├── template.go           # FormTemplate aggregate
│   │   │   ├── form.go               # Form aggregate
│   │   │   ├── assignment.go         # Assignment entity
│   │   │   ├── recurring_assignment.go
│   │   │   ├── daily_multi_submission_assignment.go
│   │   │   ├── finding.go            # Finding entity
│   │   │   ├── audit_log.go          # AuditLog entity
│   │   │   ├── tenant_config.go      # TenantConfig entity
│   │   │   ├── actor.go              # Actor value object
│   │   │   ├── question.go           # Question types and validation
│   │   │   ├── scoring.go            # Scoring engine
│   │   │   └── errors.go             # Domain errors
│   │   │
│   │   ├── httpapi/                  # HTTP controllers
│   │   │   ├── template_controller.go
│   │   │   ├── form_controller.go
│   │   │   ├── assignment_controller.go
│   │   │   ├── recurring_assignment_controller.go
│   │   │   ├── daily_multi_submission_assignment_controller.go
│   │   │   ├── finding_controller.go
│   │   │   ├── tenant_config_controller.go
│   │   │   ├── activity_controller.go
│   │   │   ├── actor_middleware.go    # JWT → Actor extraction
│   │   │   └── internal/             # DTOs (request/response models)
│   │   │
│   │   ├── usecases/                 # Business logic services
│   │   │   ├── api.go                # Service interfaces
│   │   │   ├── repository_port.go    # Repository interfaces
│   │   │   ├── template_service.go   # Template use cases
│   │   │   ├── form_service.go       # Form use cases
│   │   │   ├── assignment_service.go
│   │   │   ├── recurring_assignment_service.go
│   │   │   ├── daily_multi_submission_assignment_service.go
│   │   │   ├── finding_service.go
│   │   │   ├── tenant_config_service.go
│   │   │   └── preliminary_conversion_service.go
│   │   │
│   │   ├── persistence/              # MongoDB repositories
│   │   │   ├── template_repository.go
│   │   │   ├── form_repository.go
│   │   │   ├── assignment_repository.go
│   │   │   ├── finding_repository.go
│   │   │   ├── audit_log_repository.go
│   │   │   ├── tenant_config_repository.go
│   │   │   └── internal/             # MongoDB document models
│   │   │
│   │   └── clients/                  # External service clients
│   │       ├── angelis_client.go     # Angelis Auth API client
│   │       └── datalake_producer.go  # Azure Data Lake integration
│   │
│   ├── saffer/                       # Testing/assessment module
│   │   ├── domain/
│   │   ├── httpapi/
│   │   ├── usecases/
│   │   └── persistence/              # MySQL/GORM repositories
│   │
│   ├── control_plane/                # Configuration module
│   │   └── httpapi/
│   │
│   ├── infra/                        # Infrastructure layer
│   │   ├── httpserver/               # HTTP server, middleware, helpers
│   │   ├── async/                    # Broker and worker framework
│   │   ├── config/                   # Viper configuration
│   │   ├── node/                     # Node identification
│   │   ├── otel/                     # OpenTelemetry setup
│   │   ├── documentdb/               # MongoDB connection
│   │   ├── redis/                    # Redis client
│   │   └── azure/                    # Azure Blob Storage
│   │
│   └── pkg/                          # Shared utilities
│
├── test/
│   ├── unit/
│   │   └── doubles/                  # Generated mocks (mockgen)
│   └── functional/
│       ├── features/                 # Gherkin .feature files
│       ├── steps/                    # Step definitions
│       ├── driver/                   # API test client
│       └── suite_test.go            # Godog test runner
│
├── config/
│   └── api.yaml                     # Default configuration
│
├── docs/
│   └── openapi.yaml                 # OpenAPI 3.0 specification
│
├── compose.yaml                     # Docker Compose services
├── Dockerfile                       # Multi-stage build
├── arch-go.yml                      # Architecture validation rules
├── justfile                         # Task runner commands
├── go.mod / go.sum                  # Go module dependencies
└── .drone.yml                       # CI/CD pipeline
```

## Layer Responsibilities

| Layer | Package | Responsibility | Dependencies |
|-------|---------|---------------|-------------|
| **HTTP (Controllers)** | `httpapi` | Route registration, request parsing, response formatting, validation | `usecases` (interfaces), `domain` (types) |
| **Business Logic (Services)** | `usecases` | Business rules, orchestration, domain operations | `domain` (models), own interfaces (ports) |
| **Domain (Models)** | `domain` | Pure business entities, value objects, invariants, errors | None (zero infra dependencies) |
| **Persistence** | `persistence` | Data access, document mapping, query building | `domain` (models), `infra` (DB clients) |
| **Infrastructure** | `infra` | HTTP server, databases, caching, observability, external services | External libraries only |

> [!IMPORTANT]
> **Dependency Rule**: Each layer can only depend on layers below it. Controllers → Services → Domain. Persistence implements interfaces defined in Services. Infrastructure is shared across all modules. These rules are enforced by `arch-go` at build time.

---

# Coding Standards & Conventions

## Go Project Conventions

### Package Naming

- Use short, lowercase, single-word package names.
- Domain packages are named `domain`, not the entity name (e.g., `internal/checking/domain/` not `internal/checking/template/`).
- HTTP controller packages are named `httpapi`.
- Business logic is in `usecases`.
- Data access is in `persistence`.

### Interface Design

- Interfaces are defined **where they are used**, not where they are implemented (Ports and Adapters pattern).
- Repository interfaces live in `usecases/repository_port.go`.
- Service interfaces live in `usecases/api.go`.
- All interfaces include `//go:generate mockgen` directives for automatic mock generation.

```go
// usecases/repository_port.go
//go:generate mockgen -source=./repository_port.go -destination=../../../test/unit/doubles/checking/usecases/repository_port.go -package=usecases

type TemplateRepository interface {
    Create(ctx context.Context, template *domain.FormTemplate) error
    FindByID(ctx context.Context, id domain.ID, actor domain.Actor) (*domain.FormTemplate, error)
    // ...
}
```

### Compile-Time Interface Checks

Every implementation includes a compile-time assertion:

```go
var _ usecases.TemplateRepository = (*SimpleTemplateRepository)(nil)
var _ httpserver.Controller = &TemplateController{}
```

### Builder Pattern

Domain objects use the builder pattern for construction with validation:

```go
template, err := domain.NewFormTemplateBuilder().
    WithClientID(actor.ClientID).
    WithName(name).
    WithDescription(description).
    WithScoringEnabled(true).
    Build()
```

### Error Handling

- Domain errors are defined as sentinel errors in `domain/errors.go`:

```go
var ErrTemplateNotFound = errors.New("template not found")
var ErrTemplateNotDraft = errors.New("template is not in draft status")
```

- Controllers use `errors.Is()` for error matching and return appropriate HTTP status codes.
- Services return domain errors; controllers translate them to HTTP responses.

### Structured Logging

Use `log/slog` with context-aware logging:

```go
slog.ErrorContext(r.Context(), "creating template",
    slog.String("error", err.Error()),
    slog.String("template_id", string(id)))
```

---

# Testing Strategy

## Unit Tests (Ginkgo + Gomega)

### Test Structure

Unit tests follow BDD style using Ginkgo v2. Each package has a `suite_test.go`:

```go
package domain_test

import (
    "testing"
    "github.com/onsi/ginkgo/v2"
    "github.com/onsi/gomega"
)

func TestDomain(t *testing.T) {
    gomega.RegisterFailHandler(ginkgo.Fail)
    ginkgo.RunSpecs(t, "Domain Suite")
}
```

### Test Organization

- **`Describe`**: The subject under test (struct/function)
- **`Context`**: The method or logical grouping
- **`When`**: The specific scenario
- **`It`**: The individual test case the system should satisfy

```go
var _ = Describe("FormTemplate", func() {
    Context("Build", func() {
        When("valid parameters provided", func() {
            It("should create template successfully", func() {
                template, err := domain.NewFormTemplateBuilder().
                    WithClientID("client-123").
                    WithName(validName).
                    Build()
                Expect(err).NotTo(HaveOccurred())
                Expect(template.Name).To(Equal(validName))
            })
        })
    })
})
```

### Running Unit Tests

```bash
# All unit tests
just unit

# Specific package
just unit path="internal/checking/domain"

# With verbose output
go test -v -race ./internal/checking/domain/...
```

## Functional Tests (Cucumber/Godog)

Functional tests use Gherkin `.feature` files with step definitions:

```gherkin
Feature: Template Management
  Scenario: Create a new template
    Given I am authenticated as a supervisor
    When I create a template with name "Safety Checklist"
    Then the response status should be 201
    And the template should have status "Draft"
```

### Running Functional Tests

```bash
just functional
# Or with specific tags:
just functional tags="@templates"
```

## Mock Generation

```bash
just mock
```

This scans `//go:generate` directives in `./internal/...` and generates mocks to `test/unit/doubles/`.

---

# Build & Deployment

## Build Process

### Local Build

```bash
just build
# Output: ./api binary

just build-migration
# Output: ./migration binary
```

### Docker Build

The Dockerfile uses multi-stage builds:

```dockerfile
# Stage 1: Build
FROM golang:1.24 AS builder
WORKDIR /app
COPY . .
RUN go build -o api cmd/api/main.go

# Stage 2: Runtime
FROM alpine:latest
COPY --from=builder /app/api /api
ENTRYPOINT ["/api"]
```

### CI/CD Pipeline (Drone CI)

The `.drone.yml` defines the CI/CD pipeline:

1. **Lint**: Run `golangci-lint`
2. **Architecture Check**: Run `arch-go` validation
3. **Unit Tests**: Run with race detection and coverage
4. **Build**: Compile the binary
5. **Functional Tests**: Start services and run Godog tests
6. **Docker Build & Push**: Build and push to container registry

## Development Commands

| Command | Description |
|---------|-------------|
| `just build` | Build the API binary |
| `just run` | Build, start dependencies, and run |
| `just unit` | Run unit tests with coverage |
| `just functional` | Run functional tests |
| `just wire` | Generate Wire DI code |
| `just mock` | Generate test mocks |
| `just arch` | Validate architecture rules |
| `just migrate` | Run database migrations |
| `just release version="v1.0.0"` | Create and push git tag |

## Architecture Validation

The `arch-go.yml` enforces strict dependency rules. Key rules:

- `internal` packages cannot depend on `cmd`
- `infra` cannot depend on domain modules (`checking`, `saffer`)
- `httpapi` cannot depend on `persistence`
- `usecases` cannot depend on `persistence`
- `persistence` cannot depend on `httpapi`
- Functional test steps cannot depend on internal packages

Run validation:

```bash
just arch
```

All rules must pass at **100% compliance threshold**.
