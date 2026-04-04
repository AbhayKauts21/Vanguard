# US-006: Secure Administration (RBAC & Auth)

## 📝 User Story
**As an** Administrator,
**I want** to securely manage users, roles, and system configurations,
**so that** only authorized personnel can trigger syncs or access sensitive documentation.

## ✅ Acceptance Criteria
- [x] Implement a robust Auth system with JWT tokens (register, login, refresh, logout).
- [x] Protect API routes using RBAC (Role-Based Access Control) with granular permissions.
- [x] Persist users, roles, and permissions in a relational database (Postgres).
- [x] Implement a shared API client in the frontend to inject bearer tokens for protected routes.
- [x] Build an administrative dashboard for monitoring sync status and health.
- [x] Implement a "Clear Thread" mechanism for resetting conversational context securely.
- [x] Protect incoming BookStack webhooks using HMAC-SHA256 signature verification.
- [x] Rate limit sensitive endpoints to prevent brute-force and DDoS attacks.
- [x] Reflect user roles and permissions in the UI with a dynamic Account Status Menu.

## 🛠 Technical Mapping (features.md)
| Feature ID | Title | Module |
|---|---|---|
| F-066 | **Webhook HMAC Verification** | `backend/app/core/security.py` |
| F-067 | **Admin RBAC Protection** | `backend/app/api/deps.py` |
| F-069 | **Rate Limiting** | `backend/app/api/router_chat.py` |
| F-098 | **JWT Authentication API** | `backend/app/api/router_auth.py` |
| F-099 | **RBAC Domain Model** | `backend/app/db/models.py` |
| F-101 | **Auth UI Routes** | `frontend/src/app/[locale]/login/` |
| F-103 | **Account Status Menu** | `frontend/src/domains/auth/components/AuthStatusMenu.tsx` |
| F-107 | **Auth Verification Suite** | `backend/tests/integration/` |

## 📊 Status
- **Status**: ✅ Completed
- **Coverage**: Comprehensive integration tests for authentication and role-based access logic.
