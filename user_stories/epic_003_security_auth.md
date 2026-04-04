# EPIC-003: Auth, RBAC & Security

## Context
As a Security Admin, I want robust identity and access controls so that the knowledge handled by Project Vanguard is only accessible to authorized users.

## User Stories

### US-001: JWT Authentication System
**As a** User,
**I want** a secure registration and login system with refresh-token revocation,
**So that** my account and session are protected.
- **Reference**: F-097, F-098, F-102

### US-002: Role-Based Access Control (RBAC)
**As an** Admin,
**I want** to assign specific roles and permissions to users (e.g., `sync:manage`),
**So that** only authorized personnel can perform privileged operations.
- **Reference**: F-099, F-100, F-103

### US-003: API Hardening (CORS & Rate Limits)
**As a** Developer,
**I want** the API to have strict CORS origins and global rate limiting,
**So that** the system is protected from unauthorized requests and denial-of-service attacks.
- **Reference**: F-068, F-069, F-071

### US-004: Request Correlation (X-Request-Id)
**As an** SRE,
**I want** every request and response to include a unique correlation ID,
**So that** I can trace logs across the entire stack for debugging.
- **Reference**: F-070, F-082

### US-005: Webhook Verification (HMAC)
**As a** Security Officer,
**I want** BookStack webhooks to be verified via HMAC-SHA256 signatures,
**So that** only genuine events from our documentation provider are processed.
- **Reference**: F-066
