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
| F-003 | **OpenAI Embedding Client** — text-embedding-3-small vectorization | ✅ Done | `adapters/embedding_client.py` |
| F-004 | **Pinecone Vector Store** — Serverless vector DB with metadata filtering | ✅ Done | `adapters/vector_store.py` |
| F-005 | **OpenAI LLM Client** — gpt-4o/mini with streaming support | ✅ Done | `adapters/llm_client.py` |
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

## 🔮 Upcoming Features

| # | Feature | Priority | Target |
|---|---|---|---|
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
| F-067 | **Admin API Key Auth** — `X-API-Key` header dependency on all `/admin` routes (403 on mismatch) | ✅ Done | `backend/app/core/auth.py`, `backend/app/api/router_admin.py` |
| F-068 | **CORS Hardening** — Restricts `allow_origins` to `ALLOWED_ORIGINS` env var (no more `*`) | ✅ Done | `backend/main.py`, `backend/app/core/config.py` |
| F-069 | **Rate Limiting** — `slowapi` decorator on chat + azure-chat endpoints (`RATE_LIMIT_PER_MINUTE/min`) | ✅ Done | `backend/app/api/router_chat.py`, `backend/app/api/router_azure_chat.py` |
| F-070 | **Request-ID Middleware** — UUID `X-Request-Id` header on every request/response for log correlation | ✅ Done | `backend/app/core/middleware.py`, `backend/main.py` |
| F-071 | **Security Config** — `ADMIN_API_KEY`, `ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MINUTE` settings | ✅ Done | `backend/app/core/config.py` |
| F-072 | **Frontend Admin Auth** — Admin API client sends `X-API-Key` from `NEXT_PUBLIC_ADMIN_API_KEY` | ✅ Done | `frontend/src/domains/system/api/adminApi.ts`, `frontend/src/lib/env/index.ts` |
| F-073 | **API Client Headers Support** — `api.get()` / `api.post()` accept optional headers parameter | ✅ Done | `frontend/src/lib/api/client.ts` |

---

## 🔮 Upcoming Features

| # | Feature | Priority | Target |
|---|---|---|---|
| F-074 | Observability & Telemetry (Phase 8) | 🟢 P2 | v0.5.1 |
| F-075 | Performance, Polish & Demo Readiness (Phase 9) | 🟡 P1 | v0.6.0 |
| F-076 | Deployment & Infrastructure (Phase 10) | 🟢 P2 | v0.7.0 |

