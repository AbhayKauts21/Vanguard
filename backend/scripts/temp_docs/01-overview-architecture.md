# 01 — Overview & Architecture

---

# CheckingMate: Project Vision & Goals

## What is CheckingMate?

CheckingMate is a comprehensive **checklist and survey management platform** designed for organizations that rely on structured field inspections, safety audits, quality checks, and compliance surveys. The system enables supervisors and managers to create standardized checklist templates, assign them to field workers on configurable schedules, collect structured answers (including multimedia evidence and digital signatures), and track findings that arise from anomalous responses.

Built as a Go microservice backend (v3), CheckingMate replaces an earlier Python-based implementation to deliver improved performance, maintainability, and scalability. The backend powers two client applications: **checkingmate-app** (a mobile/web app used by workers to fill out surveys in the field) and **checkingmate-v3-admin-ui** (an admin BFF interface used by backoffice operators and supervisors to design templates, manage assignments, and review submitted forms).

The platform follows a multi-tenant model where each organization (referred to as a "client" or "tenant") operates in isolation. Tenant-level configuration governs features such as cross-supervisor assignments, daily expiry email notifications, and finding notification routing.

## Problem Statement

Organizations that perform regular safety inspections, quality audits, or compliance checks face a common set of challenges: paper-based checklists are error-prone and hard to track; existing digital solutions are rigid and do not support conditional logic, scoring, or finding management; and there is no unified pipeline from form submission through anomaly detection to corrective action plans. CheckingMate solves these problems by providing a configurable, end-to-end digital inspection workflow.

## Core Objectives

- **Configurable Template Engine**: Provide a powerful template builder that supports multiple question types (short text, long text, number, date, select, multiselect, boolean, image), conditional visibility logic, anomalous-response detection, follow-up action enforcement, and scoring configurations. Templates are versioned, enabling iterative improvements without breaking existing assignments.

- **Flexible Assignment System**: Support one-off assignments, cron-based recurring assignments, and daily multi-submission assignments (DMSA). Each assignment type enforces organizational hierarchy validation, ensuring that only authorized supervisors or managers can assign tasks to workers under their reporting chain.

- **Structured Data Collection with Validation**: Collect form submissions that are validated against their source template structure. Validation includes required-field checks (respecting conditional visibility), template-structure matching, follow-up action enforcement (comments and multimedia evidence for anomalous responses), and digital signature collection (both internal organizational signers and external third-party signers).

- **Finding and Remediation Workflow**: Automatically detect anomalous answers during form submission and generate "findings" — actionable items that supervisors must investigate, remediate, and resolve. Findings support a full lifecycle (identified → reported → resolved/dismissed) with remediation actions and threaded comments.

- **Enterprise-Grade Observability**: Integrate OpenTelemetry for distributed tracing, metrics, and structured logging across the entire request lifecycle, ensuring operational visibility in production environments.

## Success Metrics

- **API Response Latency**: p95 latency under 200ms for standard CRUD operations on all core resources.
- **Form Validation Accuracy**: 100% of submitted forms validated against their template structure before persistence.
- **Assignment Scheduling Reliability**: Zero missed recurring assignment instance generations within the 6-month maximum window.
- **Audit Trail Completeness**: Every creation, update, and status transition recorded in the audit log with actor identification.

## Target Users & Use Cases

| User Role   | Application          | Key Activities |
|-------------|---------------------|----------------|
| **Worker**  | checkingmate-app    | Receive assignments, fill out forms in the field, attach photos and signatures, view pending/late assignments |
| **Supervisor** | admin-ui (BFF)  | Create templates, assign tasks to workers, review submitted forms, manage findings and remediation actions, generate PDF reports |
| **Manager** | admin-ui (BFF)      | Oversee all supervisors and workers, configure tenant settings, view cross-team dashboards, manage audit logs |
| **System Admin** | Backend config  | Enable/disable modules, manage API keys for the control plane, configure external integrations |

**Real-world scenario**: A facilities management company uses CheckingMate to conduct daily safety inspections across 50 sites. Supervisors create a "Fire Safety Checklist" template with conditional questions (e.g., "Is the fire extinguisher present?" → if "No", require a photo and comment). Workers receive daily assignments via the mobile app, complete inspections on-site, and sign digitally. Anomalous answers automatically generate findings for the supervisor to investigate and resolve.

## Roadmap

The project is currently in its **v3 production phase**. Key completed milestones include template versioning, scoring engine, finding management with remediation actions, DMSA with reassignment, PDF generation, and the Saffer testing module. Next phases include enhanced analytics dashboards, webhook-based notifications, and real-time assignment status push events.

---

# CheckingMate System Architecture

## Architecture Overview

CheckingMate v3 Backend follows a **Layered Architecture** (also known as Clean Architecture or Hexagonal Architecture) with strict dependency rules enforced at build time by `arch-go`. The system is organized into isolated domain modules, a shared infrastructure layer, and a compile-time dependency injection system powered by Google Wire.

```
┌─────────────────────────────────────────────────────────────┐
│              HTTP Layer (Controllers)                        │
│         /internal/{module}/httpapi/                          │
│   Routes registered via httpserver.Controller interface      │
└───────────────────────┬─────────────────────────────────────┘
                        │ calls
┌───────────────────────▼─────────────────────────────────────┐
│              Business Logic Layer                            │
│         /internal/{module}/usecases/                         │
│   Service interfaces + repository port interfaces            │
└───────────────────────┬─────────────────────────────────────┘
                        │ implements
┌───────────────────────▼─────────────────────────────────────┐
│              Persistence Layer                               │
│         /internal/{module}/persistence/                      │
│   MongoDB/MySQL repository implementations                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ uses
┌───────────────────────▼─────────────────────────────────────┐
│              Infrastructure Layer                            │
│                 /internal/infra/                              │
│   HTTP Server, Async Broker, Config, OTel, DB Clients, etc. │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Module: Checking (Primary Domain)

- **Purpose**: Core checklist/survey management — templates, forms, assignments, findings, audit logs, tenant configuration.
- **Responsibilities**: Template CRUD with versioning, form submission with validation, one-off/recurring/DMSA assignment management, finding lifecycle management, scoring engine, PDF generation.
- **Technology**: Go standard library HTTP, MongoDB persistence, in-memory async broker for event-driven workers.
- **Interactions**: Consumes Angelis Auth API for hierarchy validation; publishes to Azure Data Lake for analytics; sends emails via SendGrid; stores files in Azure Blob Storage.

### Module: Saffer (Testing/Assessment)

- **Purpose**: Testing and assessment system for safety-related evaluations.
- **Responsibilities**: Test management, reaction time tracking, test result processing.
- **Technology**: MySQL/MariaDB via GORM ORM (separate from the MongoDB-based checking module).
- **Interactions**: Isolated from the checking module; shares infrastructure layer only.

### Module: Control Plane

- **Purpose**: Configuration management for system-level settings.
- **Responsibilities**: Runtime configuration endpoints, protected by API key authentication.
- **Technology**: Standard HTTP endpoints with API key middleware.

### Infrastructure Layer

- **HTTP Server**: Go `net/http` with `http.ServeMux` (Go 1.22+ routing patterns). Middleware chain: custom → JWT → logging → metrics → tracing.
- **Async Processing**: In-memory broker (`LocalBroker`) with topic-based pub/sub. Workers: AssignmentWorker, NotificationWorker, DataLakeIngestionWorker, AuditLogWorker, DailyExpiryWorker, PreliminaryConversionWorker.
- **Database Connectivity**: MongoDB driver with OTel instrumentation; MySQL/GORM for Saffer.
- **Caching**: Redis for Angelis profile caching (`CachedAngelisClient`) and distributed locking (`redsync`).
- **Observability**: OpenTelemetry SDK with OTLP gRPC export to a collector, forwarding traces to debug, metrics to Prometheus, and logs to Loki.

## Data Flow Pipeline

1. **Request Ingestion**: HTTP request → middleware chain (tracing → metrics → logging → JWT validation → actor extraction) → controller.
2. **Business Logic**: Controller calls service interface → service performs validation, hierarchy checks (via Angelis client), and domain logic.
3. **Persistence**: Service calls repository interface → repository implementation maps domain models to/from MongoDB documents.
4. **Event Publishing**: After persistence, service publishes events to the internal broker (e.g., `form_submitted`, `assignment_created`).
5. **Async Workers**: Workers subscribe to broker topics and perform side-effects: audit log writing, Data Lake ingestion (Apache Arrow/Parquet), email notifications (SendGrid), finding auto-creation.

## External Integrations

| Integration | Purpose | Protocol |
|------------|---------|----------|
| **Angelis Auth API** | Delegated authentication, JWT validation, user hierarchy (supervisor/worker relationships) | HTTPS REST |
| **Azure Blob Storage** | File uploads (form multimedia evidence, signatures) | Azure SDK |
| **Azure Data Lake** | Analytics data ingestion (Apache Arrow/Parquet format) | Azure SDK |
| **SendGrid** | Email notifications (assignment reminders, daily expiry digests, finding alerts) | HTTPS REST |
| **Mountebank** | Service mocking for functional tests | HTTP |

## Scaling Strategy

The service is containerized (Docker) and designed for horizontal scaling behind a load balancer. MongoDB handles data-tier scaling via replica sets and sharding. Redis provides distributed locking for coordinating workers across instances. The stateless HTTP layer and in-memory broker are per-instance; for multi-instance deployments, the broker can be replaced with an external message queue (e.g., NATS, RabbitMQ).

---

# CheckingMate Tech Stack Overview

## Backend

- **Language**: Go 1.24.4
  - Why chosen: Performance-critical backend replacing Python; strong concurrency model; excellent standard library for HTTP services; compile-time type safety.
  - Key libraries: `net/http` (routing), `log/slog` (structured logging), `google/uuid` (ID generation), `robfig/cron/v3` (cron scheduling), `jung-kurt/gofpdf` (PDF generation), `thoas/go-funk` (functional utilities), `iancoleman/strcase` (case conversion).

- **Dependency Injection**: Google Wire (compile-time DI)
  - Why chosen: Zero runtime overhead; generates readable, debuggable code; catches missing bindings at compile time rather than runtime.

- **Testing**: Ginkgo v2 + Gomega (BDD unit tests), Cucumber/Godog (functional tests), GoMock (mock generation)
  - Why chosen: Ginkgo provides expressive BDD-style test organization; Godog enables behavior-driven functional testing with Gherkin feature files.

## Databases

- **Primary DB**: MongoDB 8.0
  - Use case: Stores all checking module data — templates, forms, assignments, findings, audit logs, tenant configs.
  - Rationale: Document-oriented storage is ideal for storing entire form templates and completed forms as single documents, simplifying reads and avoiding complex joins (ADR-0002).
  - Driver: `go.mongodb.org/mongo-driver` with OpenTelemetry instrumentation.

- **Secondary DB**: MariaDB 11 (MySQL-compatible)
  - Use case: Saffer module only — test definitions, reaction results, test results.
  - Driver: GORM ORM with `gorm.io/driver/mysql` and OpenTelemetry plugin.

- **Cache**: Redis 7
  - Use case: Angelis profile data caching, distributed locking (via `redsync`), session data.
  - Driver: `redis/go-redis/v9` with OTel instrumentation.

## Infrastructure

- **Containerization**: Docker (multi-stage build — Go build stage → scratch/alpine runtime)
- **Local Development**: Docker Compose orchestrates MongoDB, MariaDB, Redis, OTel Collector, Prometheus, Loki
- **CI/CD**: Drone CI (`.drone.yml`)
- **Architecture Validation**: `arch-go` enforces dependency rules at 100% compliance threshold

## Observability

- **Tracing**: OpenTelemetry SDK → OTLP gRPC → OTel Collector → Debug exporter
- **Metrics**: OpenTelemetry SDK → OTLP gRPC → OTel Collector → Prometheus (remote write)
- **Logging**: `log/slog` structured logs → OTel Collector → Loki
- **Monitoring**: Prometheus for metrics storage; Loki for log aggregation

## Development Tools

- **VCS**: Git (conventional commits enforced via pre-commit hooks)
- **Task Runner**: Just (`justfile` with commands for build, run, test, lint, mock, wire, arch, migrate, release)
- **Linting**: golangci-lint
- **API Documentation**: OpenAPI 3.0 (`docs/openapi.yaml`)
- **Changelog**: git-cliff (`cliff.toml`) for automated CHANGELOG generation

---

# CheckingMate Glossary

## A

**Actor**: A domain object representing the authenticated user making a request. Contains `ClientID` (tenant identifier) and `ProfileID` (user identifier). Extracted from the JWT token by middleware.

**Angelis Auth API**: The external authentication and authorization service. CheckingMate delegates all user authentication, profile retrieval, and organizational hierarchy queries to Angelis.

**Anomalous Response**: A predefined answer value that triggers follow-up actions when selected by a worker. Configured per question in the template (e.g., "No" on a safety question is anomalous).

**arch-go**: A static analysis tool that validates architectural dependency rules defined in `arch-go.yml`. Ensures layers do not violate the dependency direction.

**Assignment**: A task assigned to a worker requiring them to complete a specific form template within a defined time window. Statuses: `pending`, `in_progress`, `completed`, `late`, `late_completed`.

**Audit Log**: An immutable record of significant actions (create, update, delete, status changes) performed by actors within the system.

## B

**Builder Pattern**: A creational design pattern used throughout the domain layer (e.g., `NewFormTemplateBuilder()`, `NewAssignmentBuilder()`) to construct domain objects with validation.

## C

**Client / ClientID**: The tenant organization identifier. All data is scoped to a client, ensuring multi-tenant isolation.

**Condition**: A rule attached to a question that controls its visibility based on another question's answer. Supports operators: `equals`, `not_equals`, `in_list`, `greater_than`, `less_than`, `contains`. Modes: `ALL` (all conditions must match) or `ANY` (at least one must match).

**Controller**: An HTTP handler component implementing the `httpserver.Controller` interface. Responsible for route registration, request parsing, and response formatting.

**Control Plane**: An optional module for system-level configuration management, protected by API key authentication.

## D

**DMSA (Daily Multi-Submission Assignment)**: A recurring assignment type that generates a configurable number of assignment instances per day over a date range. Supports worker reassignment.

**Domain Model**: Pure business logic objects in `internal/{module}/domain/`. No infrastructure dependencies.

## F

**Finding**: An actionable item auto-generated when a form answer triggers an anomalous response with a `create_finding` follow-up action. Lifecycle: `identified` → `reported` → `resolved` or `dismissed`.

**Follow-Up Action**: An action enforced when an anomalous response is detected. Types: `request_comment` (require additional comments), `require_multimedia` (require photo/video evidence), `create_finding` (auto-create a finding).

**Form**: A completed submission against a template. Contains answered sections/questions, GPS location, digital signatures, validation results, and optional scoring.

## I

**Internal Broker**: An in-memory pub/sub message broker (`LocalBroker`) for asynchronous communication between services and workers within a single process.

## P

**Pagination**: Standard limit/offset pagination used across all list endpoints. Query parameters: `page` (1-indexed) and `limit` (items per page).

**Problem Details (RFC 7807)**: The standard error response format used by all API endpoints. Returns structured JSON with `title`, `status`, and `detail` fields.

## R

**Recurring Assignment**: A cron-based assignment schedule that generates individual assignment instances across a date range (max 6 months). Uses standard 5-field cron expressions.

**Remediation Action**: A corrective action plan attached to a finding. Lifecycle: `pending` → `in_progress` → `done`.

**Repository Port**: An interface defined in the `usecases` package that abstracts data access. Implemented by the `persistence` package. Follows the Ports and Adapters pattern.

## S

**Saffer**: An optional module for testing and assessment, using MySQL/GORM. Isolated from the checking module.

**Scoring**: An optional template feature that assigns numeric scores (0–100) to question answers. Supports per-option scores for select/multiselect/boolean questions and default scores for numeric questions.

**Section**: A logical grouping of questions within a template. Sections have positions and can be reordered.

## T

**Template**: A reusable form definition containing sections and questions. Versioned (v1, v2, …) with status lifecycle: `Draft` → `Active` → `Archived`. Only draft templates can be edited.

**Tenant Config**: Per-organization settings including timezone, cross-supervisor assignment enablement, daily expiry email configuration, and finding notification preferences.

## W

**Wire**: Google's compile-time dependency injection framework. Providers defined in `cmd/api/wire/`, generated code in `wire_gen.go`.

**Worker (Async)**: Background goroutines implementing the `async.Worker` interface that subscribe to broker topics and process events asynchronously.
