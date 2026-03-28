# 04 — API Reference

---

# API Overview & Authentication

## Base URL

All API endpoints are served under the configured server port (default: `8000`). The base URL format depends on your deployment:

- **Local Development**: `http://localhost:8000`
- **Production**: Configured via `CHECKING_MATE_SERVER_API_BASE_URL`

## API Versioning

All endpoints are prefixed with `/v1/`, following URL-based versioning. Backward-incompatible changes will be introduced under new version prefixes (e.g., `/v2/`).

## Authentication

All endpoints (except `/healthz`) require a valid **JWT Bearer Token** obtained from the Angelis Auth API. Include the token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The JWT token is parsed by the middleware chain to extract the **Actor** (authenticated user context containing `ClientID` and `ProfileID`). All data operations are scoped to the actor's tenant.

## Request/Response Format

- **Content-Type**: `application/json` for all request and response bodies
- **Character Encoding**: UTF-8
- **Date Format**: RFC3339 (e.g., `2024-03-15T10:30:00Z`) for timestamps; `YYYY-MM-DD` for date-only parameters
- **Duration Format**: Go duration strings (e.g., `1h`, `30m`, `2h30m`)

## Error Response Format (RFC 7807)

All error responses follow the Problem Details standard:

```json
{
  "title": "Bad Request",
  "status": 400,
  "detail": "invalid request body"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful deletion) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict (duplicate name, invalid state) |
| `422` | Unprocessable Entity (business rule violation) |
| `500` | Internal Server Error |

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page |

Paginated responses include metadata:

```json
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 150
}
```

---

# Complete API Endpoint Catalog

## Health Check

### `GET /healthz`

No authentication required. Returns the service health status.

**Response**: `200 OK`

---

## Templates

### `POST /v1/templates`

Create a new template in Draft status.

**Request Body**:

```json
{
  "name": "Safety Checklist",
  "description": "Daily safety inspection template",
  "scoring_enabled": true,
  "fixed_fields": {"category": "safety", "region": "north"},
  "required_internal_signers": ["SUPERVISOR"],
  "required_external_signatures": 0,
  "notification_recipients": ["admin@example.com"],
  "notify_supervisor": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Unique template name (3-200 chars) |
| `description` | string | No | `""` | Template description |
| `scoring_enabled` | boolean | No | `true` | Enable question scoring |
| `fixed_fields` | object | No | `null` | Key-value metadata fields |
| `required_internal_signers` | string[] | No | `[]` | Roles required to sign (e.g., `["SUPERVISOR"]`) |
| `required_external_signatures` | integer | No | `0` | Number of external signatures required |
| `notification_recipients` | string[] | No | `[]` | Email addresses to notify |
| `notify_supervisor` | boolean | No | `true` | Whether to notify the supervisor |

**Response**: `201 Created` with the full template object.

**Error Codes**: `409 Conflict` — template name already exists.

---

### `GET /v1/templates`

List templates with optional filters.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`Draft`, `Active`, `Archived`) |
| `search` | string | Search by template name |
| `page` | integer | Page number |
| `limit` | integer | Items per page |

**Response**: `200 OK` with paginated template summaries.

---

### `GET /v1/templates/{id}`

Get the latest **active** version of a template.

**Response**: `200 OK` with full template object. `404` if no active version found.

---

### `GET /v1/templates/{id}/latest`

Get the latest version regardless of status.

---

### `GET /v1/templates/{id}/versions`

Get all versions of a template.

---

### `GET /v1/templates/{id}/versions/{version}`

Get a specific version of a template.

---

### `PATCH /v1/templates/{id}`

Update template fields. Only Draft templates can be edited (except status transitions).

**Request Body** (all fields optional):

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "Active",
  "scoring_enabled": false,
  "fixed_fields": {"category": "updated"},
  "required_internal_signers": ["SUPERVISOR", "MANAGER"],
  "required_external_signatures": 1,
  "notification_recipients": ["new@example.com"],
  "notify_supervisor": false
}
```

**Error Codes**: `409 Conflict` — name already exists or template not in Draft status.

---

### `POST /v1/templates/{id}/versions`

Create a new Draft version from an existing Active template.

**Request Body** (optional):

```json
{
  "source_version": 1
}
```

If `source_version` is omitted, copies from the latest version.

---

### `POST /v1/templates/{id}/sections`

Add a section to a Draft template.

**Request Body**:

```json
{
  "name": "Fire Equipment",
  "position": 1
}
```

---

### `POST /v1/templates/{id}/sections/{sectionID}/questions`

Add a question to a section in a Draft template.

**Request Body**:

```json
{
  "text": "Is the fire extinguisher present?",
  "type": "boolean",
  "required": true,
  "position": 1,
  "options": ["Yes", "No"],
  "anomalous_responses": ["No"],
  "follow_up_actions": ["request_comment", "create_finding"],
  "follow_up_actions_apply_unconditionally": false,
  "conditions": [
    {
      "source_question_id": "uuid-of-previous-question",
      "operator": "equals",
      "value": "Yes"
    }
  ],
  "condition_mode": "ALL",
  "scoring_config": {
    "options": {
      "Yes": 100,
      "No": 0
    }
  }
}
```

---

## Assignments

### `POST /v1/assignments`

Create a one-off assignment.

**Request Body**:

```json
{
  "template_id": "template-uuid",
  "worker_id": "worker-profile-uuid",
  "start_date_time": "2024-03-15T08:00:00Z",
  "submission_window": "8h"
}
```

**Error Codes**: `422` — template not found/active; `403` — worker not under supervisor.

---

### `GET /v1/assignments`

List assignments with optional filters.

**Query Parameters**: `status`, `worker_id`, `supervisor_id`, `template_id`, `recurring_daily_multi_submission_assignment_id`, `start_date`, `start_date_to`, `end_date_from`, `end_date` (all RFC3339).

---

### `GET /v1/assignments/{id}/form`

Get the submitted form for a specific assignment.

---

### `DELETE /v1/assignments/{id}`

Delete an assignment. Cannot delete assignments from recurring sources.

---

## Recurring Assignments

### `POST /v1/recurring-assignments`

**Request Body**:

```json
{
  "template_id": "template-uuid",
  "worker_id": "worker-profile-uuid",
  "start_date": "2024-03-15",
  "end_date": "2024-06-15",
  "submission_window": "8h",
  "cron_expression": "0 8 * * 1-5"
}
```

**Constraints**: Maximum 6-month span; cron uses standard 5-field format.

---

## Daily Multi-Submission Assignments

### `POST /v1/daily-multi-submission-assignments`

**Request Body**:

```json
{
  "template_id": "template-uuid",
  "worker_id": "worker-profile-uuid",
  "required_submissions": 3,
  "start_date": "2024-03-15T00:00:00Z",
  "end_date": "2024-06-15T23:59:59Z",
  "submission_window": "8h"
}
```

---

### `PUT /v1/daily-multi-submission-assignments/{id}/reassign`

**Request Body**:

```json
{
  "new_worker_id": "new-worker-profile-uuid"
}
```

---

## Forms

### `POST /v1/forms`

Submit a completed form. See [Form Submission & Validation](./03-core-features.md#feature-3-form-submission--validation) for the full request body structure.

---

### `POST /v1/forms/{id}/signatures`

Add an internal signer's signature to a pending form.

**Request Body**:

```json
{
  "role": "SUPERVISOR",
  "signature": {
    "type": "image",
    "value": "data:image/png;base64,..."
  }
}
```

---

### `GET /v1/forms/{id}/generate-pdf`

Generate a PDF report for a submitted form.

**Query Parameters**: `tz` (optional timezone, e.g., `America/New_York`).

**Response**: `200 OK` with `Content-Type: application/pdf`.

---

## Findings

### `GET /v1/findings`

List findings. **Restricted to supervisors and managers only.** Supports filters: `form_id`, `status`, `since_updated_at`, `since_resolved_at`, `created_at_from`, `created_at_to`, `updated_at_from`, `updated_at_to`.

---

### `GET /v1/findings/all`

List all findings for any role. Same filters as above.

---

### `PATCH /v1/findings/{id}`

Update finding status.

**Request Body**:

```json
{
  "status": "reported"
}
```

Valid status values: `identified`, `reported`, `resolved`, `dismissed`.

---

### `PATCH /v1/findings/{id}/responsible-area`

Update the responsible area for a finding.

**Request Body**:

```json
{
  "responsible_area": "Electrical Department"
}
```

---

### `POST /v1/findings/{id}/remediation-actions`

**Request Body**:

```json
{
  "description": "Replace fire extinguisher",
  "committed_date": "2024-04-01"
}
```

---

### `PATCH /v1/findings/{id}/remediation-actions/{actionId}`

**Request Body**:

```json
{
  "status": "in_progress"
}
```

---

### `POST /v1/findings/{id}/comments`

**Request Body**:

```json
{
  "content": "Ordered replacement equipment."
}
```

---

## Tenant Configuration

### `GET /v1/tenant-config`

Returns configuration for the authenticated user's tenant.

---

### `PATCH /v1/tenant-config`

**Manager role required.** Update tenant configuration.

```json
{
  "timezone": "America/New_York",
  "cross_supervisor_assignment_enabled": true,
  "daily_expiry_email": {
    "enabled": true,
    "digest_time": "08:00"
  },
  "finding_notification": {
    "enabled": true,
    "notify_supervisor": true,
    "custom_emails": ["alerts@example.com"]
  }
}
```

---

## Activities (Audit Log)

### `GET /v1/activities`

List audit log entries.

**Query Parameters**: `limit` (default 20, max 100), `offset`, `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `target_type` (e.g., `template`, `form`, `assignment`).
