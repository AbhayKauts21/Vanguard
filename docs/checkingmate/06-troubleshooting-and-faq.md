# 06 — Troubleshooting & FAQ

---

# Common Issues & Solutions

## Installation Issues

### Issue: `wire: command not found`

**Symptom**: Running `just wire` fails with "command not found".

**Root Cause**: The Wire CLI is not installed or not in the system PATH.

**Solution**:

```bash
go install github.com/google/wire/cmd/wire@latest
export PATH=$PATH:$(go env GOPATH)/bin
```

Add the PATH export to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.profile`) for persistence.

---

### Issue: Docker Compose Services Fail to Start

**Symptom**: `docker compose up -d` fails or services exit immediately.

**Root Cause**: Port conflicts with existing services or insufficient Docker resources.

**Solution**:

1. Check for port conflicts:

```bash
lsof -i :27017   # MongoDB
lsof -i :6379    # Redis
lsof -i :3306    # MariaDB
lsof -i :4317    # OTel Collector (gRPC)
```

2. Stop conflicting services or modify ports in `compose.yaml`.

3. Ensure Docker has adequate resources (4GB+ RAM recommended for all services).

---

### Issue: Build Fails with `wire_gen.go` Errors

**Symptom**: `go build` fails with missing symbols from `wire_gen.go`.

**Root Cause**: Wire-generated code is out of date after code changes.

**Solution**:

```bash
just wire
# Then rebuild
just build
```

Always run `just wire` after adding or modifying providers, bindings, or interfaces.

---

## Runtime Issues

### Issue: MongoDB Connection Refused

**Symptom**: Application starts but fails to connect to MongoDB with "connection refused" errors.

**Root Cause**: MongoDB container not ready or wrong connection string.

**Diagnosis**:

```bash
# Check if MongoDB is running and healthy
docker compose ps
# Check MongoDB logs
docker compose logs mongodb
```

**Solution**:

1. Wait for the MongoDB health check to pass (may take 10-15 seconds after container starts).
2. Verify the `CHECKING_MATE_MONGODB_URI` environment variable matches the Docker Compose service configuration.
3. For local development, ensure you're using `localhost:27017` (not `mongo:27017` unless running inside Docker).

---

### Issue: Angelis Authentication Failures

**Symptom**: All API requests return `401 Unauthorized` even with a valid-looking token.

**Root Cause**: JWT validation is performed by the middleware against the Angelis Auth API. The token may be expired, issued by a different Angelis instance, or the Angelis service may be unreachable.

**Diagnosis**:

```bash
# Test Angelis connectivity
curl -v $CHECKING_MATE_ANGELIS_BASE_URL/healthz
```

**Solution**:

- For local development, ensure Mountebank is running (started automatically by `just run`).
- Verify `CHECKING_MATE_ANGELIS_BASE_URL` points to the correct Angelis instance.
- Check that the JWT token has not expired.
- In development, check the Mountebank imposters are correctly loaded.

---

### Issue: Redis Connection Errors

**Symptom**: Application logs show Redis connection errors; Angelis profile caching falls back to direct API calls.

**Root Cause**: Redis container not running or TLS configuration mismatch.

**Solution**:

1. Verify Redis is running: `docker compose ps redis`
2. Check `CHECKING_MATE_REDIS_ADDR` matches the Docker Compose port mapping.
3. In production, ensure `CHECKING_MATE_REDIS_TLS_ENABLED` matches the Redis server configuration.

---

### Issue: Template Cannot Be Edited

**Symptom**: `PATCH /v1/templates/{id}` returns `409 Conflict` with "template is not in draft status".

**Root Cause**: Only Draft templates can be edited. Active and Archived templates are immutable.

**Solution**:

1. Create a new version from the active template: `POST /v1/templates/{id}/versions`
2. Edit the new Draft version.
3. Activate the new version when ready.

---

### Issue: Assignment Creation Fails with Hierarchy Error

**Symptom**: `POST /v1/assignments` returns `403 Forbidden` with "worker is not allowed to be assigned by this supervisor".

**Root Cause**: The authenticated user (supervisor) does not have the specified worker in their reporting chain, as determined by the Angelis Auth API.

**Solution**:

1. Verify the worker is in the supervisor's reporting chain in Angelis.
2. If cross-supervisor assignment is needed, enable it in tenant config: `PATCH /v1/tenant-config` with `"cross_supervisor_assignment_enabled": true` (requires Manager role).
3. Check that the correct `worker_id` (Angelis profile ID) is being used.

---

### Issue: Form Submission Validation Fails

**Symptom**: `POST /v1/forms` returns validation errors.

**Root Cause**: The submitted form structure does not match the source template.

**Common Causes**:

- Missing required question answers
- Section/question IDs don't match the template
- Missing follow-up data (comments/multimedia) for anomalous responses
- Template version mismatch

**Solution**:

1. Fetch the latest template: `GET /v1/templates/{id}` to verify structure.
2. Ensure every section and question ID matches the template.
3. For required questions, provide non-empty answers.
4. For anomalous responses with `request_comment` follow-up, include `additional_comments`.
5. For anomalous responses with `require_multimedia` follow-up, include `multimedia_evidence`.

---

### Issue: Recurring Assignment Exceeds Maximum Duration

**Symptom**: `POST /v1/recurring-assignments` returns "recurring tasks cannot span more than 6 months".

**Root Cause**: Business rule limits recurring assignment date ranges to 6 months maximum.

**Solution**: Split the recurring assignment into shorter periods (≤ 6 months each).

---

## Performance Issues

### Issue: Slow API Responses

**Diagnosis**:

1. Check OpenTelemetry traces for slow spans.
2. Review Prometheus metrics for high latency percentiles.
3. Check MongoDB query performance via `db.currentOp()` and explain plans.

**Common Solutions**:

- Ensure MongoDB indexes are created (run `just migrate`).
- Use pagination on list endpoints (avoid fetching all records).
- Apply filters to narrow query scope.
- Verify Redis is operational for Angelis profile caching.

---

# Frequently Asked Questions

## General

### Q: What Go version is required?

**A:** Go 1.24.4 or later. The project uses Go 1.22+ HTTP routing patterns (`GET /v1/path/{id}`) which require Go 1.22+. Module toolchain directive is set to 1.24.4.

### Q: Can I use a managed MongoDB service (Atlas, Azure Cosmos)?

**A:** Yes. Set `CHECKING_MATE_MONGODB_URI` to your managed service connection string. Ensure the connection string includes authentication and TLS settings as required by your provider.

### Q: How do I reset the local database?

**A:**

```bash
docker compose down -v   # Removes all volumes (data)
docker compose up -d     # Recreates with fresh databases
just migrate             # Re-run migrations
```

### Q: Can I disable OpenTelemetry?

**A:** Yes. Set `CHECKING_MATE_OTEL_ENABLED=false`. The application will still function normally without telemetry.

## Architecture

### Q: Why is the Saffer module using MySQL instead of MongoDB?

**A:** The Saffer module was originally a separate service with its own MySQL database. It was integrated into CheckingMate as a module while retaining its database. This demonstrates the modularity of the architecture — different modules can use different persistence backends.

### Q: Why use in-memory broker instead of RabbitMQ/Kafka?

**A:** The in-memory broker (`LocalBroker`) simplifies deployment and reduces infrastructure requirements for single-instance deployments. For multi-instance deployments, the broker can be replaced with an external message queue by implementing the `InternalBroker` interface. The current scale does not require external messaging.

### Q: How does multi-tenancy work?

**A:** Every authenticated request includes a `ClientID` extracted from the JWT token. All database queries are scoped to this `ClientID`, ensuring complete tenant data isolation. MongoDB documents include a `client_id` field, and all repository queries filter by it.

## Features

### Q: Can templates have conditional scoring?

**A:** Yes. Scoring can be configured per question. Questions that are conditionally hidden (via visibility conditions) and not answered are excluded from the score calculation.

### Q: What happens when a recurring assignment is deleted?

**A:** Deleting a recurring assignment removes the schedule and all **future** (not-yet-started) child assignments. Assignments that are already in progress or completed are not affected.

### Q: How are findings auto-created?

**A:** When a form is submitted, the system checks each answer against the template's `anomalous_responses` list. If an answer matches and the question has a `create_finding` follow-up action, a finding is automatically created with status `identified`, linked to the form and the specific question.

### Q: Can external signers be added after form submission?

**A:** External signatures are provided at form creation time. After submission, only internal signers (based on the template's `required_internal_signers`) can be added via `POST /v1/forms/{id}/signatures`.

---

# Logging & Debugging Guide

## Log Levels

| Level | Config Value | Description |
|-------|-------------|-------------|
| DEBUG | `debug` | Detailed diagnostic information (may include request bodies) |
| INFO | `info` | General operational events |
| WARN | `warn` | Potential issues that don't prevent operation |
| ERROR | `error` | Error conditions that require attention |

Set the log level via `CHECKING_MATE_GENERAL_LOG_LEVEL`.

## Structured Log Format

All logs use `slog` structured format:

```
level=ERROR msg="creating template" error="template name already exists" template_name="Safety Checklist"
```

## Distributed Tracing

When OpenTelemetry is enabled, every HTTP request receives a trace ID. This ID is propagated through:

1. HTTP middleware (incoming request → trace context extraction)
2. Service layer (span creation for business operations)
3. Repository layer (MongoDB instrumented spans)
4. Async workers (trace context passed via broker messages)

### Viewing Traces

Traces are exported via OTLP to the configured OTel Collector, then forwarded to the configured backend (debug, Jaeger, Zipkin, etc.).

## Debugging Common Scenarios

### Debugging Form Validation Failures

1. Enable `debug` log level.
2. Submit the form and check logs for validation details:

```
level=ERROR msg="form validation failed" error="required question not answered" question_id="uuid" question_text="Is the area safe?"
```

3. Compare the form payload against the template structure.

### Debugging Hierarchy Validation

1. Check Angelis client logs for hierarchy lookup results.
2. Verify the worker's reporting chain in the Angelis system.
3. If using Redis caching, clear the cache to force a fresh lookup.

### Debugging Async Workers

1. Check for broker subscriber/publisher logs.
2. Each worker logs its startup and any processing errors.
3. Workers run in separate goroutines; check for panic recovery logs.
