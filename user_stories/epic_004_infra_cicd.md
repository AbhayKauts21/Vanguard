# EPIC-004: Infrastructure & CI/CD

## Context
As a DevOps Engineer, I want automated, immutable, and scalable infrastructure so that I can deliver consistent versions of Project Vanguard with high reliability.

## User Stories

### US-001: Containerized Portability (Docker)
**As a** Developer,
**I want** Dockerfiles for both backend and frontend,
**So that** I can run the entire system locally or with one command on a server.
- **Reference**: F-091, F-092, F-093

### US-002: Infrastructure as Code (Terraform)
**As a** Cloud Architect,
**I want** to provision Azure Virtual Machines and Networking via Terraform,
**So that** my production environment is reproducible and version-controlled.
- **Reference**: F-113, F-114, F-119, F-121

### US-003: Automated CI (GitHub Actions)
**As a** Developer,
**I want** a 4-job pipeline to test, lint, and build the system on every pull request,
**So that** I catch regressions early and never ship broken code.
- **Reference**: F-094, F-127, F-129

### US-004: Automated Deployment CD
**As a** Release Manager,
**I want** a manual dispatch workflow to deploy to production,
**So that** new versions are shipped through an immutable and secure process.
- **Reference**: F-132, F-137, F-138

### US-005: HTTPS & Reverse Proxy (NGINX + Certbot)
**As a** User,
**I want** a secure SSL connection via Let's Encrypt,
**So that** my interactions with CLEO are encrypted and trustworthy.
- **Reference**: F-141, F-142
