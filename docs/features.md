# 🛡️ PROJECT VANGUARD — Feature Documentation

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

---

## 🔮 Upcoming Features

| # | Feature | Priority | Target |
|---|---|---|---|
| F-021 | Conversation memory (multi-turn) | 🟡 P1 | v0.3.0 |
| F-022 | Health check endpoint | 🟡 P1 | v0.3.0 |
| F-023 | HeyGen Avatar integration | 🔴 P0 | v0.3.0 |
| F-024 | OpenTelemetry distributed tracing | 🟢 P2 | v0.3.0 |
| F-025 | Frontend (Next.js) | 🔴 P0 | v0.3.0 |
