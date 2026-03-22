# Auth & RBAC Module Plan

## Requirements

### Functional
- Users can register with `email`, `password`, and optional `full_name`.
- Users can log in with email and password and receive:
  - short-lived JWT access token
  - long-lived refresh token
- Users can refresh an expired access token using a valid refresh token.
- Users can log out, which revokes the refresh token used for the session.
- Authenticated users can fetch their own profile via `GET /api/v1/auth/me`.
- The system supports many-to-many role assignment:
  - one user can have multiple roles
  - one role can have multiple permissions
- The system supports many-to-many permission mapping:
  - one permission can belong to multiple roles
- Privileged users can:
  - list roles
  - create roles
  - list permissions
  - create permissions
  - assign roles to users
  - assign permissions to roles
- Existing privileged ingestion routes move to JWT/RBAC protection.

### Non-Functional
- Postgres is the source of truth for auth/RBAC persistence.
- SQLAlchemy 2.x async session is used in the app layer.
- Alembic manages schema evolution.
- Passwords are stored as secure hashes, never plaintext.
- JWTs include enough claims to identify the user and token type safely.
- Refresh tokens are persisted so they can be revoked and rotated.
- Routes remain thin; orchestration stays in services, persistence in repositories, security helpers in dedicated modules.

## Data Model
- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `refresh_tokens`

## Seeded Defaults
- Roles:
  - `admin`
  - `operator`
  - `developer`
  - `viewer`
- Permissions:
  - `sync:manage`
  - `rbac:manage`
  - `users:read`
  - `users:manage`
  - `chat:use`

## API Surface
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/rbac/roles`
- `POST /api/v1/rbac/roles`
- `GET /api/v1/rbac/permissions`
- `POST /api/v1/rbac/permissions`
- `POST /api/v1/rbac/roles/{role_id}/permissions`
- `POST /api/v1/rbac/users/{user_id}/roles`

## Test Cases

### Auth
- Registration creates a new active user and assigns the default role.
- Registration rejects duplicate email addresses.
- Login returns valid access and refresh tokens for correct credentials.
- Login rejects invalid credentials.
- `GET /auth/me` returns the authenticated user profile with roles and permissions.
- Refresh rotates the refresh token and returns a new access token.
- Logout revokes the provided refresh token.
- Refresh fails for revoked tokens.

### RBAC
- A user with `rbac:manage` can create roles.
- A user with `rbac:manage` can create permissions.
- A user with `rbac:manage` can assign permissions to roles.
- A user with `users:manage` can assign roles to users.
- A user without required permissions receives `403`.
- Admin ingestion endpoints require `sync:manage`.

### Persistence & Migration
- Alembic upgrade creates all auth/RBAC tables.
- Default roles and permissions exist after migration.
- Refresh tokens are persisted with revocation state.

### Security
- Passwords are stored hashed.
- Access tokens are rejected if the token type is wrong.
- Inactive users cannot authenticate.
