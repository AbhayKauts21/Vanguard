# 🧠 CLEO — Feature Documentation

> **CLEO** — *Contextual Learning & Enterprise Oracle*
> This file tracks all features as they are implemented. Updated continuously throughout development.

---

## 📋 Feature Log

### v0.1.0 — Foundation & Data Ingestion Pipeline (2026-03-16)

| # | Feature | Status | Module |
|---|---|---|---|
| F-001 | **Project Configuration** — Centralized env-based settings via Pydantic | ✅ Done | `core/config.py` |
| F-002 | **BookStack API Client** — Async REST client for pages, books, chapters | ✅ Done | `adapters/bookstack_client.py` |
| F-003 | **Embedding Client Facade** — provider-backed semantic vectorization entrypoint | ✅ Done | `adapters/embedding_client.py` |
| F-004 | **Pinecone Vector Store** — Serverless vector DB with metadata filtering | ✅ Done | `adapters/vector_store.py` |
| F-005 | **Azure LLM Client** — Azure OpenAI generation with streaming support | ✅ Done | `adapters/llm_client.py` |
| F-006 | **Text Processor** — HTML→text cleaning + semantic chunking | ✅ Done | `services/text_processor.py` |
| F-007 | **Ingestion Service** — Full pipeline: fetch→clean→chunk→embed→upsert | ✅ Done | `services/ingestion_service.py` |
| F-008 | **Auto-Sync Scheduler** — APScheduler polls BookStack every N minutes | ✅ Done | `services/sync_scheduler.py` |
| F-009 | **BookStack Webhook Receiver** — Real-time page create/update/delete sync | ✅ Done | `api/router_webhook.py` |
| F-010 | **Admin Ingestion API** — Full re-sync, single page sync, status check | ✅ Done | `api/router_admin.py` |
| F-011 | **RAG Orchestrator** — Embed query→search→confidence gate→generate with citations | ✅ Done | `services/rag_service.py` |
| F-012 | **Chat API with Streaming** — SSE streaming + BookStack citations | ✅ Done | `api/router_chat.py` |
| F-013 | **Domain Error Handling** — RFC 7807 problem details for all domain errors | ✅ Done | `core/exceptions.py` |
| F-014 | **Prompt Engineering** — Context-constrained system prompt preventing hallucinations | ✅ Done | `core/prompts.py` |

### v0.2.0 — Azure OpenAI Direct Chat Module (2026-03-17)

| # | Feature | Status | Module |
|---|---|---|---|
| F-015 | **Azure OpenAI Foundry Client** — direct synchronous chat via Azure deployment | ✅ Done | `adapters/azure_openai_client.py` |
| F-016 | **Azure Chat Service** — stateless prompt + context orchestration with middleware hooks | ✅ Done | `services/azure_chat_service.py` |
| F-017 | **Azure Chat API** — dedicated `POST /api/v1/azure-chat/` endpoint | ✅ Done | `api/router_azure_chat.py` |
| F-018 | **Azure Prompt Builder** — deterministic context serialization for direct chat | ✅ Done | `core/azure_prompts.py` |
| F-019 | **Azure Smoke Test Script** — manual validation against a live deployment | ✅ Done | `scripts/test_azure_chat.py` |
| F-020 | **Azure Direct Chat Tests** — unit + integration coverage for config, middleware, and routing | ✅ Done | `tests/unit/test_azure_chat_module.py` |

### v0.2.1 — CLEO Neural Interface Frontend (2026-03-16)

| # | Feature | Status | Module |
|---|---|---|---|
| F-021 | **Next.js Scaffold** — App Router, TypeScript strict, Tailwind v4, Radix UI | ✅ Done | `frontend/` |
| F-022 | **i18n Foundation** — next-intl locale routing (en/es), LanguageSwitcher | ✅ Done | `i18n/`, `middleware.ts` |
| F-023 | **Design Token System** — CSS custom properties for colors, spacing, typography | ✅ Done | `styles/tokens.css` |
| F-024 | **Animation Library** — 7 keyframes, utility classes, prefers-reduced-motion | ✅ Done | `styles/animations.css` |
| F-025 | **Layout Components** — AppShell, TopBar, FooterStatusBar, SplitPanelLayout | ✅ Done | `components/layout/` |
| F-026 | **UI Primitives** — Button (4 variants), GlassCard, Skeleton, StatusBadge | ✅ Done | `components/ui/` |
| F-027 | **Chat Interface** — ChatPanel, MessageBubble, MessageList, Composer, EmptyState | ✅ Done | `components/chat/` |
| F-028 | **Chat State Management** — Zustand store with full streaming lifecycle | ✅ Done | `domains/chat/model/` |
| F-029 | **API Client** — Typed fetch wrapper with ApiError, GET/POST/stream methods | ✅ Done | `lib/api/client.ts` |
| F-030 | **Chat Integration** — useChat hook for non-streaming message flow | ✅ Done | `domains/chat/hooks/useChat.ts` |
| F-031 | **SSE Streaming** — SSE parser, consumeSSEStream, useChatStream hook | ✅ Done | `lib/api/sse-parser.ts`, `domains/chat/hooks/` |
| F-032 | **Ambient Effects** — ParticleCanvas, ScanlineOverlay, GhostTerminal, NeuralSvgOverlay | ✅ Done | `components/effects/` |
| F-033 | **Avatar Shell & Telemetry** — Live health/sync polling, AvatarTelemetry badges | ✅ Done | `components/avatar/`, `domains/system/` |
| F-034 | **Test Suite** — 52 Vitest tests across 8 files with Istanbul coverage | ✅ Done | `src/**/*.test.ts` |

### v0.2.2 — Visual Upgrades Batch 1 (2026-03-18)

| # | Feature | Status | Module |
|---|---|---|---|
| F-035 | **Physics Engine Module** — standalone 2D particle physics (gravity, jitter, mouse forces) | ✅ Done | `lib/physics/` |
| F-036 | **Avatar Sphere Extraction** — reusable AvatarSphere + AvatarBadge components | ✅ Done | `components/avatar/AvatarSphere.tsx`, `AvatarBadge.tsx` |
| F-037 | **Dynamic Liquid Core** — dual-layer SVG turbulence, mouse-reactive displacement | ✅ Done | `components/effects/LiquidFilter.tsx` |
| F-038 | **CLEO-01 Title Fix** — separated from sphere, z-index layering | ✅ Done | `components/avatar/AvatarPanel.tsx` |
| F-039 | **Anti-Gravity Particles** — 1200 particles, baseX/baseY return physics, 150px mouse repulsion, sphere masking | ✅ Done | `components/effects/ParticleCanvas.tsx` |
| F-040 | **Color Palette Overhaul** — #000000 body, rgba(8,8,12,0.7) panels, reference palette | ✅ Done | `styles/globals.css` |
| F-041 | **Z-Index Hierarchy** — canvas:100 → avatar:101 → scanline:110 → neural:120 → header:150 | ✅ Done | `styles/globals.css`, multiple components |
| F-042 | **HexGrid Removal** — removed HexGridBackground per design revision | ✅ Done | `components/effects/`, `components/layout/AppShell.tsx` |

### v0.3.0 — Phase 1: Bug Fixes & Contract Alignment (2026-03-21)

| # | Feature | Status | Module |
|---|---|---|---|
| F-043 | **BUG-001: Exception Hierarchy Fix** — `VanguardError` → `CleoError` for Azure exceptions | ✅ Done | `core/exceptions.py` |
| F-044 | **BUG-002: Citation Contract Alignment** — source-agnostic Citation type (`source_url`, `source_type`, `source_name`) across backend + frontend | ✅ Done | `domain/schemas.py`, `types/index.ts`, `MessageBubble.tsx`, `rag_service.py` |
| F-045 | **E-002: Empty Knowledge Base Guard** — graceful error when Pinecone has no vectors | ✅ Done | `services/rag_service.py` |
| F-046 | **E-013: Webhook Event Validation** — Pydantic validator rejects unknown webhook events | ✅ Done | `domain/schemas.py` |
| F-047 | **ENV Templates Update** — Added `ADMIN_API_KEY`, `ALLOWED_ORIGINS`, HeyGen fields | ✅ Done | `.env.example` (both) |

---

### v0.3.1 — Phase 2: RAG Chat End-to-End Hardening (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-048 | **CitationRanker Service** — Tiered grouping of Citations by confidence score | ✅ Done | `backend/services/citation_ranker.py` |
| F-049 | **Tiered Citations API** — `primary_citations`, `secondary_citations`, `all_citations` schema | ✅ Done | `backend/domain/schemas.py`, `backend/api/router_chat.py` |
| F-050 | **Frontend Stream Resiliency** — Error categorization (`errorType` state) and banners | ✅ Done | `frontend/domains/chat/hooks/useChatStream.ts`, `ChatPanel.tsx` |
| F-051 | **CitationList Component** — Expandable sources list depending on primary/secondary tiers | ✅ Done | `frontend/components/chat/CitationList.tsx` |
| F-052 | **Smart Auto-Scroll Logic** — Pauses when scrolled up, floating indicator button | ✅ Done | `frontend/components/chat/MessageList.tsx` |

### v0.4.0 — Phase 6: HeyGen Interactive Avatar Integration (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-053 | **HeyGen Streaming Avatar SDK** — WebRTC session management with `@heygen/streaming-avatar` | ✅ Done | `frontend/domains/avatar/hooks/useHeyGenAvatar.ts` |
| F-054 | **Avatar Zustand Store** — Connection, loading, muted, visual state machine (disconnected→idle→listening→speaking) | ✅ Done | `frontend/domains/avatar/model/avatar-store.ts` |
| F-055 | **Avatar Type Definitions** — `AvatarVisualState`, `AvatarConfig`, `AvatarVoiceMapping`, `HeyGenTokenResponse` | ✅ Done | `frontend/domains/avatar/model/types.ts` |
| F-056 | **Avatar API Client** — Server-side token proxy client (`fetchHeyGenToken`) | ✅ Done | `frontend/domains/avatar/api/avatarApi.ts` |
| F-057 | **Avatar State Machine Hook** — `useAvatarState` with derived booleans (isSpeaking, isListening, isIdle, etc.) | ✅ Done | `frontend/domains/avatar/hooks/useAvatarState.ts` |
| F-058 | **AvatarVideo Component** — `<video>` mount for WebRTC stream with loading/error/listening overlays | ✅ Done | `frontend/components/avatar/AvatarVideo.tsx` |
| F-059 | **AvatarControls Component** — Mute/unmute button, connection dot, state label overlay | ✅ Done | `frontend/components/avatar/AvatarControls.tsx` |
| F-060 | **AvatarPanel Feature Flag** — Swaps AvatarSphere ↔ AvatarVideo via `NEXT_PUBLIC_ENABLE_AVATAR` | ✅ Done | `frontend/components/avatar/AvatarPanel.tsx` |
| F-061 | **HeyGen Token Route** — Next.js API route keeps `HEYGEN_API_KEY` server-side | ✅ Done | `frontend/app/api/heygen/token/route.ts` |
| F-062 | **Chat→Avatar Bridge** — Triggers `speak()` on stream done + sets "listening" on send | ✅ Done | `frontend/domains/chat/hooks/useChatStream.ts` |
| F-063 | **Locale-Aware Voice** — Per-locale HeyGen voice mapping (en/es) via env vars | ✅ Done | `frontend/lib/env/index.ts`, `useHeyGenAvatar.ts` |
| F-064 | **WebRTC Leak Prevention** — `beforeunload` event handler + useEffect cleanup on unmount | ✅ Done | `frontend/domains/avatar/hooks/useHeyGenAvatar.ts` |
| F-065 | **Avatar i18n** — Mute/unmute, speaking/listening/idle, state labels in en + es | ✅ Done | `frontend/messages/en.json`, `es.json` |

---

### v0.5.0 — Phase 7: Security, Auth & Webhook Verification (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-066 | **Webhook HMAC-SHA256 Verification** — Validates `X-BookStack-Signature` header before processing events | ✅ Done | `backend/app/core/security.py`, `backend/app/api/router_webhook.py` |
| F-067 | **Admin RBAC Protection** — `/admin` routes require bearer auth plus `sync:manage` permission | ✅ Done | `backend/app/api/deps.py`, `backend/app/api/router_admin.py` |
| F-068 | **CORS Hardening** — Restricts `allow_origins` to `ALLOWED_ORIGINS` env var (no more `*`) | ✅ Done | `backend/main.py`, `backend/app/core/config.py` |
| F-069 | **Rate Limiting** — `slowapi` decorator on chat + azure-chat endpoints (`RATE_LIMIT_PER_MINUTE/min`) | ✅ Done | `backend/app/api/router_chat.py`, `backend/app/api/router_azure_chat.py` |
| F-070 | **Request-ID Middleware** — UUID `X-Request-Id` header on every request/response for log correlation | ✅ Done | `backend/app/core/middleware.py`, `backend/main.py` |
| F-071 | **Security Config** — `ADMIN_API_KEY`, `ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MINUTE` settings | ✅ Done | `backend/app/core/config.py` |
| F-072 | **Frontend Bearer Auth Integration** — Shared API client injects the persisted JWT access token for protected routes | ✅ Done | `frontend/src/lib/api/client.ts`, `frontend/src/domains/system/api/adminApi.ts` |
| F-073 | **API Client Headers Support** — `api.get()` / `api.post()` accept optional headers parameter | ✅ Done | `frontend/src/lib/api/client.ts` |

---

### v0.5.1 — Phase 8: Observability & Telemetry (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-074 | **Structured JSON Logging** — loguru-based logging with JSON serialization, dev-mode color output, `log_pipeline_step` context manager | ✅ Done | `backend/app/core/logging.py` |
| F-075 | **RAG Pipeline Telemetry** — Structured log points at every pipeline step (embed, search, gate, generate) with timing + metadata | ✅ Done | `backend/app/services/rag_service.py` |
| F-076 | **Request-Level Logging** — `request.received` / `request.completed` with `duration_ms` on chat endpoints | ✅ Done | `backend/app/api/router_chat.py` |
| F-077 | **Client Telemetry Store** — Zustand store tracking TTFT latency (rolling avg), vector count, backend status | ✅ Done | `frontend/src/domains/system/model/telemetry-store.ts` |
| F-078 | **Detailed Health Hook** — Polls `/health/detailed` every 60s, syncs vector count + status to telemetry store | ✅ Done | `frontend/src/domains/system/hooks/useDetailedHealth.ts` |
| F-079 | **Time-to-First-Token Measurement** — `performance.now()` around SSE stream, records TTFT in telemetry store | ✅ Done | `frontend/src/domains/chat/hooks/useChatStream.ts` |
| F-080 | **Live Telemetry Badges** — AvatarPanel badges show real latency (ms) and Pinecone vector count | ✅ Done | `frontend/src/components/avatar/AvatarPanel.tsx` |
| F-081 | **Live Sync Status Telemetry** — AvatarTelemetry shows real-time sync/backend status with visual feedback | ✅ Done | `frontend/src/components/avatar/AvatarTelemetry.tsx` |
| F-082 | **Frontend Request-ID Correlation** — API client logs `X-Request-Id` from response headers for debugging | ✅ Done | `frontend/src/lib/api/client.ts` |

---

### v0.6.0 — Phase 9: Performance, Polish & Demo Readiness (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-083 | **ChatPanel Skeleton** — Shimmer loading state mimicking message bubbles + composer for initial load | ✅ Done | `frontend/src/components/chat/ChatPanelSkeleton.tsx` |
| F-084 | **AdminPanel Skeleton** — Full skeleton for SyncStatusCard, HealthGrid, SyncLog, and SyncControls | ✅ Done | `frontend/src/domains/system/components/AdminPanelSkeleton.tsx` |
| F-085 | **Backend Offline Banner** — Amber pulse banner in ChatPanel when health check fails, auto-dismisses on reconnect | ✅ Done | `frontend/src/components/chat/OfflineBanner.tsx` |
| F-086 | **Admin Empty State** — "No sync data available. Run your first sync." with icon when no data exists | ✅ Done | `frontend/src/domains/system/components/SyncStatusCard.tsx` |
| F-087 | **Avatar Failure Fallback** — Falls back to AvatarSphere with error overlay + "Falling back to ambient sphere" label | ✅ Done | `frontend/src/components/avatar/AvatarVideo.tsx` |
| F-088 | **Demo Environment Configs** — `.env.demo` for backend (gpt-4o, tuned thresholds) and frontend (all features enabled) | ✅ Done | `backend/.env.demo`, `frontend/.env.demo` |
| F-089 | **Offline i18n Keys** — `offlineTitle` / `offlineHint` in en + es for offline banner localization | ✅ Done | `frontend/src/messages/en.json`, `es.json` |
| F-090 | **Suspense Admin Page** — Admin page wrapped in `<Suspense>` with `AdminPanelSkeleton` fallback | ✅ Done | `frontend/src/app/[locale]/admin/page.tsx` |

---

### v0.7.0 — Phase 10: Deployment & Infrastructure (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-091 | **Backend Dockerfile** — Python 3.12-slim, pip install, uvicorn production CMD, curl for healthcheck | ✅ Done | `backend/Dockerfile` |
| F-092 | **Frontend Dockerfile** — Multi-stage build (node:20-alpine), `next build` → standalone output, optimized runner | ✅ Done | `frontend/Dockerfile` |
| F-093 | **Docker Compose** — Orchestrates backend + frontend, healthcheck dependency, port mapping, restart policy | ✅ Done | `docker-compose.yml` |
| F-094 | **GitHub Actions CI** — 4-job pipeline: backend tests, frontend tests + build, lint, Docker build verification | ✅ Done | `.github/workflows/ci.yml` |
| F-095 | **Next.js Standalone Output** — `output: "standalone"` in next.config.ts for Docker-optimized builds | ✅ Done | `frontend/next.config.ts` |
| F-096 | **Docker Ignore Files** — `.dockerignore` for backend + frontend to keep images lean | ✅ Done | `backend/.dockerignore`, `frontend/.dockerignore` |

---

### v0.8.0 — Auth, RBAC & Access UX (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-097 | **Postgres Auth Persistence** — Async SQLAlchemy session management, declarative auth models, and Alembic migrations | ✅ Done | `backend/app/db/`, `backend/alembic/` |
| F-098 | **JWT Authentication API** — `register`, `login`, `refresh`, `logout`, and `me` endpoints with refresh-token revocation | ✅ Done | `backend/app/api/router_auth.py`, `backend/app/services/auth_service.py` |
| F-099 | **RBAC Domain Model** — Users, roles, permissions, join tables, seeded defaults, and identity mapping | ✅ Done | `backend/app/db/models.py`, `backend/app/services/identity_mapper.py` |
| F-100 | **RBAC Management API** — Role listing/creation, permission listing/creation, role-permission assignment, and user-role assignment | ✅ Done | `backend/app/api/router_rbac.py`, `backend/app/services/rbac_service.py` |
| F-101 | **Auth UI Routes** — Localized login, register, and informational forgot-password pages on the CLEO shell | ✅ Done | `frontend/src/app/[locale]/login/`, `frontend/src/app/[locale]/register/`, `frontend/src/app/[locale]/forgot-password/` |
| F-102 | **Auth Session Store** — Persisted auth state with user profile, tokens, and logout clearing | ✅ Done | `frontend/src/domains/auth/model/`, `frontend/src/domains/auth/api/` |
| F-103 | **Account Status Menu** — Top-bar session menu with role badge, permission count, navigation, and logout action | ✅ Done | `frontend/src/domains/auth/components/AuthStatusMenu.tsx`, `frontend/src/components/layout/TopBar.tsx` |
| F-104 | **Local Auth UX Hardening** — 127.0.0.1 CORS/dev-origin support, frontend local API base URL, and user-facing auth copy | ✅ Done | `backend/app/core/config.py`, `frontend/.env.local`, `frontend/src/messages/` |
| F-105 | **Auth Theme Cleanup** — Missing shared token definitions fixed and redundant right-side auth panel removed | ✅ Done | `frontend/src/styles/tokens.css`, `frontend/src/domains/auth/components/AuthPageShell.tsx` |
| F-106 | **Hydration-Safe Session Label** — Stable SSR fallback for session status, then client-side session ID reveal after mount | ✅ Done | `frontend/src/components/chat/SessionStatus.tsx` |
| F-107 | **Auth Verification Suite** — Backend auth/RBAC tests, frontend auth component tests, session hydration test, and smoke script | ✅ Done | `backend/tests/integration/test_auth_rbac_router.py`, `backend/tests/unit/test_auth_security.py`, `frontend/src/domains/auth/`, `frontend/src/components/chat/SessionStatus.test.tsx`, `backend/scripts/test_auth_rbac.py` |

---

### v0.8.1 — Azure Embedding Provider Upgrade (2026-03-22)

| # | Feature | Status | Module |
|---|---|---|---|
| F-108 | **Azure OpenAI Text Embeddings** — `embedding_client.py` now supports Azure OpenAI embeddings (text-embedding-3-large) for document vectorization | ✅ Done | `backend/app/adapters/embedding_client.py` |
| F-109 | **Azure Chat Completion Service** — Dedicated `azure_chat_service.py` for Azure OpenAI chat completions with system prompts and citation formatting | ✅ Done | `backend/app/services/azure_chat_service.py` |
| F-110 | **Azure Chat Endpoint** — New `/chat/azure` endpoint exposes Azure OpenAI chat with RAG for frontend integration | ✅ Done | `backend/app/api/router_azure_chat.py` |
| F-111 | **Azure Integration Tests** — E2E test script validates Azure OpenAI embeddings + chat flow | ✅ Done | `backend/scripts/test_azure_chat.py`, `backend/tests/integration/test_azure_chat_router.py` |
| F-112 | **Azure Prompts & Config** — System prompts and config variables for Azure OpenAI chat (model, temperature, max tokens) | ✅ Done | `backend/app/core/azure_prompts.py`, `backend/app/core/config.py` |

---

### v0.9.0 — Azure Infrastructure & Terraform Deployment (2026-03-23)

| # | Feature | Status | Module |
|---|---|---|---|
| F-113 | **Terraform Azure Providers** — AzureRM (~3.0) and AzureAD (~2.0) provider configured with subscription/tenant ID variables | ✅ Done | `infrastructure/terraform/providers.tf` |
| F-114 | **Terraform Variables** — Configurable inputs for subscription, tenant, resource group, location, VM size, SSH key, tags | ✅ Done | `infrastructure/terraform/variables.tf` |
| F-115 | **Azure Service Principal from Terraform** — Creates Azure AD application, service principal, password, and assigns Contributor role to Vanguard resource group | ✅ Done | `infrastructure/terraform/main.tf` (azuread_application, azuread_service_principal, azuread_service_principal_password, azurerm_role_assignment) |
| F-116 | **Azure Virtual Network** — VNet (10.0.0.0/16) with subnet (10.0.1.0/24) configured for VM deployment | ✅ Done | `infrastructure/terraform/main.tf` (azurerm_virtual_network, azurerm_subnet) |
| F-117 | **Network Security Group** — NSG with inbound rules for SSH (22), HTTP (80), HTTPS (443), Grafana (3000), PostgreSQL (5432) | ✅ Done | `infrastructure/terraform/main.tf` (azurerm_network_security_group, azurerm_subnet_network_security_group_association) |
| F-118 | **Public IP & Network Interface** — Static public IP with DNS label for SSH access, NIC with IP configuration | ✅ Done | `infrastructure/terraform/main.tf` (azurerm_public_ip, azurerm_network_interface) |
| F-119 | **Linux VM** — Ubuntu 22.04 LTS, Standard_B4ms (4 vCPU, 16GB RAM), 128GB Premium SSD, SSH-only authentication | ✅ Done | `infrastructure/terraform/main.tf` (azurerm_linux_virtual_machine) |
| F-120 | **VM Init Script** — Bootstrap bash script (`init.sh`) installs Docker CE, PostgreSQL with remote access, Grafana OSS, Docker Compose v2.24.5 | ✅ Done | `infrastructure/terraform/init.sh` |
| F-121 | **Terraform Outputs** — Exports public IP, SSH command, Grafana/PostgreSQL URLs, VM admin username, Service Principal credentials (sensitive) | ✅ Done | `infrastructure/terraform/outputs.tf` |
| F-122 | **Terraform Configuration Template** — `.tfvars.example` with sample values for all required variables | ✅ Done | `infrastructure/terraform/terraform.tfvars.example` |
| F-123 | **Terraform Gitignore** — Protects `.tfstate`, `.tfvars`, `.terraform/`, and backup files from version control | ✅ Done | `infrastructure/terraform/.gitignore` |
| F-124 | **Terraform Deployment Guide** — Complete README with prerequisites, quick start, verification steps, and cleanup instructions | ✅ Done | `infrastructure/terraform/README.md` |
| F-125 | **Azure Service Principal Setup Guide** — Step-by-step instructions for creating SP with Azure CLI, GitHub secrets config, troubleshooting | ✅ Done | `infrastructure/terraform/AZURE_SP_SETUP.md` |
| F-126 | **CI/CD Quick Start Guide** — Developer workflow for feature branch → PR (terraform plan) → merge (terraform apply) | ✅ Done | `infrastructure/terraform/CICD_QUICK_START.md` |
| F-127 | **GitHub Actions Terraform Workflow** — Automated CI/CD with 3 jobs: terraform-plan (on PR with plan comment), terraform-apply (on main merge), terraform-drift-detection (daily cron) | ✅ Done | `.github/workflows/terraform.yml` |
| F-128 | **Terraform Plan PR Comments** — Workflow posts formatted terraform plan output as PR comment with diff highlighting | ✅ Done | `.github/workflows/terraform.yml` (terraform-plan job) |
| F-129 | **Terraform Apply Auto-deploy** — Main branch merges trigger automatic `terraform apply` with production environment protection | ✅ Done | `.github/workflows/terraform.yml` (terraform-apply job) |
| F-130 | **Terraform Drift Detection** — Daily scheduled job checks for infrastructure drift and reports in workflow summary | ✅ Done | `.github/workflows/terraform.yml` (terraform-drift-detection job) |

---

## 🔮 Upcoming Features

| # | Feature | Priority | Target |
|---|---|---|---|
| F-131 | **Azure VM Auto-scaling** — Implement VM scale sets based on CPU/memory thresholds | 🔥 High | v0.10.0 |
| F-132 | **Azure Key Vault Integration** — Migrate secrets and credentials to Azure Key Vault | 🔥 High | v0.10.0 |
| F-133 | **Azure Monitor Integration** — Configure Azure Monitor for VM metrics, logs, and alerts | 🟡 Medium | v0.10.0 |
| F-134 | **Terraform State Remote Backend** — Migrate state to Azure Storage with state locking | 🟡 Medium | v0.11.0 |

