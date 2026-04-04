# US-008: Automated Infrastructure (DevOps)

## 📝 User Story
**As a** DevOps Engineer,
**I want** a repeatable, automated infrastructure and deployment pipeline,
**so that** I can deploy CLEO to Azure with high confidence, consistency, and zero manual toil.

## ✅ Acceptance Criteria
- [x] Provision Azure Virtual Networks, Network Security Groups, and Public IPs using Terraform.
- [x] Automatically deploy an Ubuntu Linux VM tailored for CLEO and its observability stack.
- [x] Containerize both backend (Python 3.12) and frontend (Next.js) with optimized Dockerfiles.
- [x] Orchestrate all services (backend, frontend, postgres, observability) using Docker Compose.
- [x] Implement a multi-job GitHub Actions CI pipeline for unit tests, linting, and build verification.
- [x] Automate the full deployment workflow, including environment secret injection and NGINX configuration.
- [x] Configure Let's Encrypt SSL certificates automatically via Certbot.
- [x] Implement a "Manual Deploy" trigger with target selection (all, backend, frontend, etc.).
- [x] Ensure 100% IAC coverage for the infrastructure deployment including Terraform state management.

## 🛠 Technical Mapping (features.md)
| Feature ID | Title | Module |
|---|---|---|
| F-091 | **Backend Dockerfile** | `backend/Dockerfile` |
| F-093 | **Docker Compose** | `docker-compose.yml` |
| F-094 | **GitHub Actions CI** | `.github/workflows/ci.yml` |
| F-113 | **Terraform Azure Providers** | `infrastructure/terraform/providers.tf` |
| F-119 | **Linux VM Provisioning** | `infrastructure/terraform/main.tf` |
| F-132 | **Manual Deploy Workflow** | `.github/workflows/deploy.yml` |
| F-141 | **NGINX + HTTPS Automation** | `.github/workflows/deploy.yml` |

## 📊 Status
- **Status**: ✅ Completed
- **Automation**: One-click deployment from provision to HTTPS production endpoint.
