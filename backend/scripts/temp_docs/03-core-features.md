# 03 — Core Features

---

# Feature 1: Template Management

## What is Template Management?

The Template Management feature allows supervisors and managers to create, version, and manage reusable checklist/survey definitions. A **FormTemplate** is the blueprint that defines the structure of a form — its sections, questions, validation rules, scoring configuration, conditional logic, and follow-up action triggers.

Templates follow a lifecycle: they start as **Draft** (editable), transition to **Active** (assignable to workers), and can be **Archived** when no longer needed. This lifecycle ensures that active templates in use cannot be accidentally modified, while the versioning system enables iterative improvements without breaking existing assignments.

## Problem it Solves

Without templates, organizations must recreate checklist structures for every inspection. This leads to inconsistencies, errors, and difficulty in comparing results across inspections. CheckingMate's template system provides standardized, reusable, versioned form definitions with rich question configuration.

## Use Cases

- **Safety Audit Templates**: A facilities manager creates a "Monthly Fire Safety Audit" template with 5 sections and 30 questions, including conditional questions that appear only when certain answers are given.
- **Quality Control Checklists**: A manufacturing supervisor designs a quality checklist with scoring, where each question's answer contributes to an overall quality score.
- **Template Versioning**: When regulations change, the supervisor creates a new version of the template (v2) from the active template, modifies questions, and publishes it — all without affecting assignments using v1.

## How it Works

### Template Structure

```
FormTemplate
├── ID (UUID)
├── Name
├── Description
├── Status (Draft | Active | Archived)
├── Version (1, 2, 3, ...)
├── ScoringEnabled (boolean)
├── FixedFields (key-value metadata)
├── RequiredInternalSigners (roles that must sign)
├── RequiredExternalSignatures (count)
├── NotificationRecipients (email addresses)
├── Sections[]
│   ├── ID (UUID)
│   ├── Name
│   ├── Position (ordered)
│   └── Questions[]
│       ├── ID (UUID)
│       ├── Text
│       ├── Type (short_text|long_text|number|date|select|multiselect|boolean|image)
│       ├── Required (boolean)
│       ├── Position (ordered)
│       ├── Options[] (for select/multiselect)
│       ├── AnomalousResponses[] (trigger follow-up actions)
│       ├── FollowUpActions[] (request_comment|require_multimedia|create_finding)
│       ├── FollowUpActionsApplyUnconditionally (boolean)
│       ├── Conditions[] (conditional visibility)
│       ├── ConditionMode (ALL|ANY)
│       └── ScoringConfig (per-option scores for select/boolean/number types)
└── Timestamps (CreatedAt, UpdatedAt)
```

### Question Types

| Type | Description | Supports Scoring | Supports Anomalous |
|------|------------|-----------------|-------------------|
| `short_text` | Single-line text input | No | No |
| `long_text` | Multi-line text input | No | No |
| `number` | Numeric input | Yes (default score) | No |
| `date` | Date picker | No | No |
| `select` | Single choice from options | Yes (per-option) | Yes |
| `multiselect` | Multiple choices from options | Yes (per-option) | Yes |
| `boolean` | True/False toggle | Yes (per-option) | Yes |
| `image` | Photo upload | No | No |

### Conditional Logic

Questions can be conditionally visible based on answers to previous questions. Conditions reference a **source question ID**, an **operator**, and a **value**:

- `equals` / `not_equals`: Exact match comparison
- `in_list`: Value exists in a list
- `greater_than` / `less_than`: Numeric comparison
- `contains`: Substring match

Condition modes: `ALL` (all conditions must match for question to show) or `ANY` (at least one match).

> [!IMPORTANT]
> Conditions can only reference questions that appear **before** the current question (no forward references). This is validated at template creation time.

### Template Versioning

1. Start with an Active template (e.g., "Safety Checklist" v1).
2. Call `POST /v1/templates/{id}/versions` to create a new Draft (v2) with all content copied from v1.
3. Modify sections and questions in v2 while v1 remains Active and in use.
4. Activate v2 — both versions coexist, but new assignments use v2.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/templates` | Create a new template (Draft) |
| `GET` | `/v1/templates` | List templates (paginated, filterable by status/search) |
| `GET` | `/v1/templates/{id}` | Get latest active version |
| `GET` | `/v1/templates/{id}/latest` | Get latest version (any status) |
| `GET` | `/v1/templates/{id}/versions` | Get all versions |
| `GET` | `/v1/templates/{id}/versions/{version}` | Get specific version |
| `PATCH` | `/v1/templates/{id}` | Update template (name, description, status, settings) |
| `POST` | `/v1/templates/{id}/versions` | Create new version from existing |
| `POST` | `/v1/templates/{id}/sections` | Add section |
| `PATCH` | `/v1/templates/{id}/sections/{sectionID}` | Update section (name, position) |
| `DELETE` | `/v1/templates/{id}/sections/{sectionID}` | Delete section (must be empty) |
| `POST` | `/v1/templates/{id}/sections/{sectionID}/questions` | Add question |
| `PATCH` | `/v1/templates/{id}/sections/{sectionID}/questions/{questionID}` | Update question |
| `DELETE` | `/v1/templates/{id}/sections/{sectionID}/questions/{questionID}` | Delete question |

## Limitations

- Templates can only be edited in **Draft** status. Active and Archived templates are immutable.
- Sections must be emptied of all questions before deletion.
- Templates must have at least one section with at least one question before activation.
- Template names must be unique per tenant.

---

# Feature 2: Assignment Management

## What is Assignment Management?

The Assignment Management feature enables supervisors and managers to assign form templates to workers within defined time windows. CheckingMate supports three assignment types:

1. **One-off Assignments**: A single assignment with a start time and submission window (duration).
2. **Recurring Assignments**: Cron-based schedules that generate individual assignment instances over a date range (max 6 months).
3. **Daily Multi-Submission Assignments (DMSA)**: A recurring daily schedule that generates a configurable number of assignment instances per day, supporting worker reassignment.

## Problem it Solves

Field inspections often need to be scheduled regularly (daily, weekly) or ad-hoc. Without a flexible assignment system, supervisors must manually track who needs to do what and when, leading to missed inspections and compliance gaps.

## Assignment Lifecycle

```
              create
                │
                ▼
           ┌─────────┐
           │ pending  │
           └────┬─────┘
                │ worker opens / time passes
                ▼
         ┌──────────────┐
    ┌────┤ in_progress   │────┐
    │    └──────────────┘    │
    │ deadline passes         │ form submitted
    ▼                         ▼
┌────────┐           ┌───────────┐
│  late  │           │ completed │
└───┬────┘           └───────────┘
    │ form submitted
    ▼
┌────────────────┐
│ late_completed │
└────────────────┘
```

## Hierarchy Validation

Before creating any assignment, CheckingMate validates the organizational hierarchy through the Angelis Auth API:

- **Supervisors** can only assign tasks to workers who directly report to them.
- **Managers** can assign tasks to any worker under their organizational hierarchy (including workers under different supervisors, when cross-supervisor assignment is enabled in tenant config).

## API Endpoints

### One-off Assignments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/assignments` | Create assignment |
| `GET` | `/v1/assignments` | List assignments (filterable by status, worker, supervisor, template, dates) |
| `GET` | `/v1/assignments/{id}` | Get assignment by ID |
| `GET` | `/v1/assignments/{id}/form` | Get submitted form for assignment |
| `DELETE` | `/v1/assignments/{id}` | Delete assignment (not allowed for completed or recurring-sourced) |

### Recurring Assignments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/recurring-assignments` | Create recurring assignment (generates instances) |
| `GET` | `/v1/recurring-assignments` | List recurring assignments |
| `GET` | `/v1/recurring-assignments/{id}` | Get recurring assignment |
| `DELETE` | `/v1/recurring-assignments/{id}` | Delete recurring assignment and future instances |

### Daily Multi-Submission Assignments (DMSA)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/daily-multi-submission-assignments` | Create DMSA |
| `GET` | `/v1/daily-multi-submission-assignments` | List DMSAs |
| `GET` | `/v1/daily-multi-submission-assignments/{id}` | Get DMSA |
| `DELETE` | `/v1/daily-multi-submission-assignments/{id}` | Delete DMSA |
| `PUT` | `/v1/daily-multi-submission-assignments/{id}/reassign` | Reassign to a different worker |

---

# Feature 3: Form Submission & Validation

## What is Form Submission?

Form submission is the core data collection workflow. Workers complete assigned forms by providing answers to each question, attaching multimedia evidence where required, and signing digitally. The form is validated against its source template before persistence.

## Validation Pipeline

When a form is submitted, CheckingMate performs a multi-stage validation:

1. **Template Structure Validation**: Every section and question in the form must match the source template (same IDs, names, types, positions, required flags).
2. **Required Field Validation**: All required questions must have non-empty answers. Conditional questions that are not visible (based on the submitted answers to their source questions) are skipped.
3. **Follow-Up Action Enforcement**: For anomalous responses, the system verifies that required follow-up data is present (additional comments, multimedia evidence).
4. **Signature Validation**: The worker's digital signature is required. If the template specifies required internal signers (e.g., supervisor), the form enters `pending_for_approval` status until all signatures are collected.
5. **Position Normalization**: Form positions are normalized from the template to handle clients that send incorrect position values.

## Scoring Engine

When a template has scoring enabled, the system calculates a form score after submission:

- **Select/Multiselect/Boolean**: Each option can have a per-option score (0–100). Multiselect averages scores of selected options.
- **Number**: Uses a default score value.
- The overall form score is the average of all individual question scores, weighted equally.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/forms` | Submit a completed form |
| `GET` | `/v1/forms` | List forms (filterable by worker, assignment, dates, status, search) |
| `GET` | `/v1/forms/{id}` | Get form by ID |
| `POST` | `/v1/forms/{id}/signatures` | Add internal signer signature |
| `GET` | `/v1/forms/{id}/generate-pdf` | Generate PDF report (with optional timezone) |

---

# Feature 4: Findings & Remediation

## What are Findings?

Findings are actionable items automatically created when a form answer matches an anomalous response that has a `create_finding` follow-up action. They represent issues that need investigation and corrective action by the assigned supervisor.

## Finding Lifecycle

```
Auto-created on form submission
         │
         ▼
   ┌──────────────┐
   │  identified   │
   └──────┬───────┘
          │ supervisor reports
          ▼
   ┌──────────────┐
   │   reported    │
   └──────┬───────┘
          │
     ┌────┴────┐
     ▼         ▼
┌─────────┐ ┌───────────┐
│resolved │ │ dismissed │
└─────────┘ └───────────┘
```

## Remediation Actions

Supervisors can add remediation actions to a finding with a description and optional committed date. Each action has its own lifecycle: `pending` → `in_progress` → `done`. When a finding is resolved, all pending/in-progress remediation actions are automatically marked as done.

## Comments

Findings support threaded comments that are immutable once created. Only the assigned supervisor can add comments and remediation actions.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/findings` | List findings (supervisors/managers only) |
| `GET` | `/v1/findings/all` | List all findings (all roles) |
| `GET` | `/v1/findings/{id}` | Get finding by ID |
| `PATCH` | `/v1/findings/{id}` | Update finding status |
| `PATCH` | `/v1/findings/{id}/responsible-area` | Update responsible area |
| `POST` | `/v1/findings/{id}/remediation-actions` | Add remediation action |
| `PATCH` | `/v1/findings/{id}/remediation-actions/{actionId}` | Update remediation action status |
| `POST` | `/v1/findings/{id}/comments` | Add comment |

---

# Feature 5: Tenant Configuration

## What is Tenant Configuration?

Each organization (tenant) in CheckingMate has configurable settings that control system behavior for their account. Only users with the **Manager** role can modify tenant configuration.

## Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Timezone | string | `UTC` | Used for daily assignment expiry calculations and email scheduling |
| Cross-Supervisor Assignment | boolean | `false` | When enabled, managers can assign workers across supervisor boundaries |
| Daily Expiry Email | object | Disabled, 08:00 | Email digest for assignments approaching their deadline |
| Finding Notification | object | Disabled | Email alerts when new findings are created |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/tenant-config` | Get current tenant configuration |
| `PATCH` | `/v1/tenant-config` | Update tenant configuration (Manager only) |

---

# Advanced Usage Guide

## Combining Multiple Features

### End-to-End Inspection Workflow

1. **Create Template** with conditional logic: "Is equipment functioning?" → if "No", show "Describe the malfunction" and require photo evidence.
2. **Set up DMSA** for daily inspections with 3 required submissions per day.
3. **Workers complete** assignments daily. Anomalous responses auto-create findings.
4. **Supervisors review** findings, add remediation actions, track resolution.
5. **Managers monitor** via audit log activities and tenant-level dashboards.

### Template Scoring Strategy

For quality audits, configure scoring at the question level:

- Boolean questions: "Is the area clean?" → Yes = 100, No = 0
- Select questions: "Condition rating" → Excellent = 100, Good = 75, Fair = 50, Poor = 25
- The form score is auto-calculated as the average of all scored questions.

### Worker Reassignment

When a worker is unavailable, use DMSA reassignment to transfer all future daily assignments to another worker in one API call:

```bash
curl -X PUT http://localhost:8000/v1/daily-multi-submission-assignments/{id}/reassign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -d '{"new_worker_id": "new-worker-uuid"}'
```

This updates the DMSA parent entity and all future (open and upcoming) child assignments.

## Performance Optimization

- **Pagination**: Always use pagination for list endpoints. Default limit is 20; maximum recommended is 100.
- **Filtered Queries**: Use filters (status, worker_id, date ranges) to narrow results and reduce database load.
- **Template Caching**: The Angelis client uses Redis-backed caching (`CachedAngelisClient`) to avoid repeated calls for profile/hierarchy data.

## Async Processing

The following events trigger asynchronous processing via the internal broker:

| Event | Workers Triggered |
|-------|------------------|
| Form submitted | AuditLogWorker, NotificationWorker, DataLakeIngestionWorker, Finding detection |
| Assignment created/deleted | AuditLogWorker |
| Template published | AuditLogWorker, PreliminaryConversionWorker |
| Assignment expired | AuditLogWorker, DailyExpiryWorker |
| DMSA reassigned | AuditLogWorker, Assignment updates |
