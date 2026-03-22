# 🛡️ PROJECT VANGUARD — MASTER IMPLEMENTATION PLAN
## Automatic Data Ingestion Pipeline + RAG Backend

> **Goal:** Build a fully automatic pipeline where content created/updated in BookStack flows into Pinecone without manual intervention, powering the AI Avatar's RAG chat.

---

## 📋 TABLE OF CONTENTS
1. [Architecture Review & Hackathon Readiness](#1-architecture-review--hackathon-readiness)
2. [Model & API Comparison Matrix](#2-model--api-comparison-matrix)
3. [Vector DB Comparison & Final Recommendation](#3-vector-db-comparison--final-recommendation)
4. [System Architecture — Automatic Ingestion Pipeline](#4-system-architecture--automatic-ingestion-pipeline)
5. [Step-by-Step Implementation Plan](#5-step-by-step-implementation-plan)
6. [File Structure & Module Design](#6-file-structure--module-design)
7. [Configuration & Environment Variables](#7-configuration--environment-variables)
8. [Getting Started Checklist](#8-getting-started-checklist)

---

## 1. Architecture Review & Hackathon Readiness

### ✅ What's Strong (Keep As-Is)
| Aspect | Verdict | Why |
|---|---|---|
| **Clean Architecture / DDD** | 🟢 Excellent | Judges love seeing production-grade patterns in a hackathon. The adapters/services/domain split is textbook perfect. |
| **RAG Pipeline Design** | 🟢 Excellent | 3-step Retrieve→Augment→Generate with confidence gating is the gold-standard RAG pattern. The threshold-based graceful decline prevents hallucinations — a **major judging criterion**. |
| **Tech Stack Choices** | 🟢 Solid | FastAPI + Pinecone + OpenAI + HeyGen is a premium, cloud-native stack. Zero Docker overhead means fast demo setup. |
| **Diagrams & Documentation** | 🟢 Outstanding | The ER diagram, state machine, sequence diagram, and use-case diagram are competition-grade. Most hackathon teams have ZERO docs. |
| **Streaming Architecture** | 🟢 Smart | Token-by-token streaming via SSE gives near-instant perceived response time. |

### ⚠️ What's Missing (Must Build)
| Gap | Impact | Priority |
|---|---|---|
| **No data ingestion pipeline exists** | The entire RAG system is dead without data in Pinecone. Nothing works. | 🔴 P0 — CRITICAL |
| **No BookStack ↔ Pinecone connector** | You mentioned automation — currently there's nothing pulling data from BookStack. | 🔴 P0 — CRITICAL |
| **No embedding adapter** | The OpenAI embedding call doesn't exist in code yet. | 🔴 P0 |
| **No Pinecone adapter** | The vector store client doesn't exist in code yet. | 🔴 P0 |
| **No RAG orchestrator service** | The `router_chat.py` returns a hardcoded string. The service layer is empty. | 🔴 P0 |
| **No chunking strategy** | BookStack pages need to be split into small paragraphs before embedding. | 🟡 P1 |
| **No webhook/polling for auto-sync** | For the "automatic" pipeline, you need either BookStack webhooks or a polling scheduler. | 🟡 P1 |

### 🏆 Hackathon Edge Analysis
Your approach is **strong for a hackathon**. Here's why:
- **RAG + Avatar combo is rare** — most teams do chatbot OR avatar, not both.
- **BookStack as a real knowledge base** shows enterprise-readiness, not just toy data.
- **Confidence-gated responses** show maturity (judges hate hallucinating demos).
- **The automatic pipeline** (if you build it) shows you thought about operations, not just a one-shot demo.

**Potential risk:** If the pipeline isn't automated, a judge asking "what happens when new docs are added?" and you saying "we run a script manually" will lose you points. The automation is a **differentiator**.

---

## 2. Model & API Comparison Matrix

### 🧠 LLM (Generation) — Final Recommendation: **gpt-4o-mini (dev) → gpt-4o (demo)**

| Model | Speed (TTFT) | Quality | Cost/1M input | Context Window | Streaming | Verdict |
|---|---|---|---|---|---|---|
| **gpt-4o** | ~300ms | ⭐⭐⭐⭐⭐ | $2.50 | 128K | ✅ | 🏆 **Demo day** |
| **gpt-4o-mini** | ~200ms | ⭐⭐⭐⭐ | $0.15 | 128K | ✅ | 🏆 **Development** |
| Claude 3.5 Sonnet | ~400ms | ⭐⭐⭐⭐⭐ | $3.00 | 200K | ✅ | ❌ Different API, HeyGen assumes OpenAI |
| Llama 3.1 70B (Groq) | ~100ms | ⭐⭐⭐⭐ | Free tier | 128K | ✅ | ❌ Rate limits during heavy testing |
| Gemini 2.0 Flash | ~150ms | ⭐⭐⭐⭐ | $0.10 | 1M | ✅ | 🟡 Backup option, great speed |

**Decision:** Stick with your current plan. `gpt-4o-mini` for dev (30x cheaper), flip one env var to `gpt-4o` for demo day. The OpenAI ecosystem keeps everything consistent (embeddings + generation = 1 API key).

### 🧮 Embedding Model — Final Recommendation: **Azure text-embedding-3-large**

| Model | Dimensions | Cost/1M tokens | Quality (MTEB) | Vendor Lock-in | Verdict |
|---|---|---|---|---|---|
| text-embedding-3-small | 1536 | $0.020 | 62.3% | OpenAI | 🟡 Lower-cost fallback |
| **text-embedding-3-large** | 3072 | $0.130 | 64.6% | Azure/OpenAI | 🏆 **Current project default** |
| Cohere embed-v3 | 1024 | $0.100 | 64.5% | Cohere | ❌ Second vendor key |
| all-MiniLM-L6-v2 | 384 | Free | 56.3% | None (local) | ❌ Much lower quality |
| Voyage AI voyage-3 | 1024 | $0.060 | 67.1% | Voyage | 🟡 Best quality but another vendor |

**Decision:** `text-embedding-3-large` is the project default. We are standardizing on Azure OpenAI embeddings and planning Pinecone around 3072-dimensional vectors.

### 🎥 Avatar — Final Recommendation: **HeyGen Interactive Avatar**

| Service | Latency | Quality | WebRTC | React SDK | Cost |
|---|---|---|---|---|---|
| **HeyGen Interactive** | <2s | ⭐⭐⭐⭐⭐ | ✅ | ✅ `@heygen/streaming-avatar` | Trial credits |
| D-ID Creative Reality | <3s | ⭐⭐⭐⭐ | ✅ | Partial | Trial credits |
| Azure AI Speech Avatar | ~5s | ⭐⭐⭐⭐ | ❌ (complex) | ❌ | Pay-per-min |
| Synthesia | N/A (batch) | ⭐⭐⭐⭐⭐ | ❌ | ❌ | ❌ Not real-time |

**Decision:** HeyGen is correct. Lip-sync quality + dedicated React SDK + WebRTC streaming = best "wow factor" for judges. Keep D-ID as backup.

---

## 3. Vector DB Comparison & Final Recommendation

### 🏆 Recommendation: **Pinecone Serverless** (Stick with current choice)

| Database | Setup Time | Free Tier | Managed | Python SDK | LangChain Native | Hackathon Fit |
|---|---|---|---|---|---|---|
| **Pinecone Serverless** | 5 min | 2GB free | ✅ Fully | ✅ `pinecone-client` | ✅ First-class | 🏆 **BEST** |
| Qdrant Cloud | 10 min | 1GB free | ✅ | ✅ | ✅ | 🟢 Great backup |
| Qdrant Local | 20 min | Unlimited | ❌ Docker | ✅ | ✅ | ⚠️ Docker overhead |
| ChromaDB | 2 min | Unlimited | ❌ In-memory | ✅ | ✅ | ❌ Data lost on restart |
| pgvector | 30 min | N/A | ❌ | Partial | Partial | ❌ Overkill, needs Postgres |
| Weaviate Cloud | 10 min | 500MB free | ✅ | ✅ | ✅ | 🟢 Good alternative |

**Why Pinecone wins for this hackathon:**
1. **Zero infrastructure** — No Docker, no containers, no local storage management.
2. **2GB free** — That's ~2-3 million chunks. You'll never hit the limit.
3. **LangChain has first-class `PineconeVectorStore`** — 5 lines of code to connect.
4. **Cosine similarity built-in** — No config needed.
5. **Metadata filtering** — You can filter by `bookstack_book_id`, `page_id`, etc. which is perfect for targeted updates.

---

## 4. System Architecture — Automatic Ingestion Pipeline

### The Dual-Strategy Automation Model

Your pipeline needs TWO trigger mechanisms for real automation:

```
┌─────────────────────────────────────────────────────────┐
│                AUTOMATIC INGESTION PIPELINE              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  STRATEGY A: WEBHOOK (Real-time, <5 sec latency)       │
│  ─────────────────────────────────────────────          │
│  BookStack → webhook on page_create/update/delete       │
│           → POST to FastAPI /api/v1/webhook/bookstack   │
│           → Validate signature                          │
│           → Fetch full page content via BookStack API   │
│           → Chunk text → Embed via OpenAI               │
│           → Upsert into Pinecone                        │
│                                                         │
│  STRATEGY B: POLLING (Fallback, every 5 minutes)        │
│  ─────────────────────────────────────────────          │
│  APScheduler background job inside FastAPI              │
│           → GET /api/pages?filter[updated_at:gt]=X      │
│           → Compare with last_sync timestamp            │
│           → For each changed page: chunk → embed → upsert│
│           → Update last_sync timestamp                  │
│                                                         │
│  STRATEGY C: MANUAL TRIGGER (Admin safety net)          │
│  ─────────────────────────────────────────────          │
│  Admin → POST /api/v1/admin/ingest (full re-sync)      │
│       → POST /api/v1/admin/ingest/{page_id} (single)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why Both Webhook + Polling?
- **Webhooks** give you real-time sync (<5 sec) — a "wow" for judges.
- **Polling** is the safety net — if a webhook fails, the poller catches it within 5 min.
- **Manual trigger** lets you do a full initial load or fix issues on-demand.

### Data Flow — Ingestion Pipeline

```
BookStack Page Created/Updated
        │
        ▼
┌─────────────────────┐
│  1. FETCH CONTENT    │  BookStack API: GET /api/pages/{id}
│     (HTML + metadata)│  Returns: title, html, book_id, chapter_id, url
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  2. CLEAN & PARSE    │  BeautifulSoup: strip HTML tags, extract text
│     (HTML → Text)    │  Preserve structure (headings = section breaks)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  3. CHUNK TEXT       │  RecursiveCharacterTextSplitter (LangChain)
│     (Smart Split)    │  chunk_size=800, overlap=200
│                      │  Respects sentence boundaries
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  4. GENERATE         │  Azure text-embedding-3-large
│     EMBEDDINGS       │  Batch: up to 2048 texts per API call
│                      │  Returns: [3072-dim vector per chunk]
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  5. UPSERT TO        │  Pinecone: upsert(vectors, namespace="bookstack")
│     PINECONE         │  ID format: "page_{page_id}_chunk_{index}"
│                      │  Metadata: {page_id, title, book_id, url, chunk_text}
└─────────────────────┘
```

### For Deletions:
```
BookStack Page Deleted
        │
        ▼
Pinecone: delete(filter={"page_id": deleted_page_id})
   → Removes ALL chunks for that page
```

---

## 5. Step-by-Step Implementation Plan

### Phase 1: Foundation (Day 1-2) 🔴 DO FIRST
| # | Task | Details |
|---|---|---|
| 1.1 | **Create Pinecone Index** | Go to pinecone.io → Create index `vanguard-docs`, dimensions=3072, metric=cosine, serverless (AWS) |
| 1.2 | **Set up `.env`** | Add `OPENAI_API_KEY`, `PINECONE_API_KEY`, `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID`, `BOOKSTACK_TOKEN_SECRET` |
| 1.3 | **Update `requirements.txt`** | Add `langchain-openai`, `langchain-pinecone`, `langchain-text-splitters`, `apscheduler` |
| 1.4 | **Build BookStack Adapter** | `adapters/bookstack_client.py` — Fetch pages, books, chapters via REST API |
| 1.5 | **Build Pinecone Adapter** | `adapters/vector_store.py` — Initialize index, upsert vectors, query, delete |
| 1.6 | **Build Embedding Adapter** | `adapters/embedding_client.py` — Resolve Azure/OpenAI embedding providers behind one interface |

### Phase 2: Ingestion Pipeline (Day 2-3) 🔴 CRITICAL
| # | Task | Details |
|---|---|---|
| 2.1 | **Build Text Processor** | `services/text_processor.py` — HTML→text cleaning, chunking with RecursiveCharacterTextSplitter |
| 2.2 | **Build Ingestion Service** | `services/ingestion_service.py` — Orchestrates: fetch→clean→chunk→embed→upsert |
| 2.3 | **Build Webhook Endpoint** | `api/router_webhook.py` — Receives BookStack webhook POSTs, triggers ingestion |
| 2.4 | **Build Polling Scheduler** | `services/sync_scheduler.py` — APScheduler job that polls BookStack every 5 min |
| 2.5 | **Build Admin Endpoints** | Update `api/router_admin.py` — Full re-sync, single page sync, sync status |
| 2.6 | **Initial Data Load** | Run `POST /api/v1/admin/ingest` to load ALL existing BookStack pages |

### Phase 3: RAG Chat Pipeline (Day 3-4) 🟡 HIGH
| # | Task | Details |
|---|---|---|
| 3.1 | **Build LLM Adapter** | `adapters/llm_client.py` — ChatOpenAI wrapper with streaming |
| 3.2 | **Build RAG Orchestrator** | `services/rag_service.py` — The core: embed query→search Pinecone→construct prompt→stream response |
| 3.3 | **Wire Chat Router** | Update `router_chat.py` to call RAG service, return streaming response with citations |
| 3.4 | **Prompt Engineering** | Create system prompt template that constrains LLM to only use provided context |

### Phase 4: Polish & Demo Prep (Day 4-5) 🟢 NICE-TO-HAVE
| # | Task | Details |
|---|---|---|
| 4.1 | **Add conversation memory** | Track multi-turn conversations per session_id |
| 4.2 | **Add observability** | Loguru structured logging for every pipeline step |
| 4.3 | **Add health checks** | `GET /health` — verify Pinecone, OpenAI, BookStack connectivity |
| 4.4 | **Switch to gpt-4o** | Flip `OPENAI_MODEL` env var for demo day |
| 4.5 | **Load test** | Verify the pipeline handles concurrent queries |

---

## 6. File Structure & Module Design

```
backend/
├── main.py                          # FastAPI app factory (exists ✅)
├── requirements.txt                 # Dependencies (needs updates ⚠️)
├── .env                             # API keys (create ❌)
├── .env.example                     # Template (create ❌)
├── app/
│   ├── __init__.py
│   ├── core/
│   │   ├── config.py                # Pydantic Settings (exists ✅, needs additions)
│   │   ├── exceptions.py            # Error handlers (exists ✅)
│   │   └── prompts.py               # System prompt templates (create ❌)
│   ├── domain/
│   │   ├── schemas.py               # Pydantic DTOs (exists ✅, needs additions)
│   │   └── enums.py                 # Sync status enums (create ❌)
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── bookstack_client.py      # BookStack REST API client (create ❌)
│   │   ├── vector_store.py          # Pinecone client wrapper (create ❌)
│   │   ├── embedding_client.py      # OpenAI embedding wrapper (create ❌)
│   │   └── llm_client.py            # OpenAI chat completion wrapper (create ❌)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── text_processor.py        # HTML cleaning + chunking (create ❌)
│   │   ├── ingestion_service.py     # Full ingestion orchestrator (create ❌)
│   │   ├── rag_service.py           # RAG query orchestrator (create ❌)
│   │   └── sync_scheduler.py        # APScheduler background poller (create ❌)
│   └── api/
│       ├── __init__.py
│       ├── router_chat.py           # Chat endpoint (exists ✅, needs wiring)
│       ├── router_admin.py          # Admin ingestion endpoints (exists ✅, needs impl)
│       └── router_webhook.py        # BookStack webhook receiver (create ❌)
└── tests/
    ├── unit/
    │   ├── test_text_processor.py
    │   └── test_ingestion_service.py
    └── integration/
        └── test_bookstack_client.py
```

---

## 7. Configuration & Environment Variables

### `.env` File Template
```env
# === Project ===
PROJECT_NAME=Project Vanguard
DEBUG=true

# === OpenAI ===
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini           # Switch to gpt-4o for demo day
EMBEDDING_PROVIDER=azure
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# === Pinecone ===
PINECONE_API_KEY=pcsk_xxxxxxxxxxxx
PINECONE_INDEX_NAME=vanguard-docs
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

# === BookStack ===
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id
BOOKSTACK_TOKEN_SECRET=your_token_secret

# === Ingestion Pipeline ===
CHUNK_SIZE=800                      # Characters per chunk
CHUNK_OVERLAP=200                   # Overlapping chars between chunks
MIN_SIMILARITY_SCORE=0.78           # Below this = "I don't know"
SYNC_INTERVAL_MINUTES=5             # Polling frequency
TOP_K_RESULTS=5                     # Number of chunks to retrieve

# === Webhook ===
BOOKSTACK_WEBHOOK_SECRET=your_webhook_secret  # For signature verification
```

### Updated `config.py` Settings Model
All the above should be added to the existing `Settings` class in `config.py`.

---

## 8. Getting Started Checklist

### Right Now (Prerequisites)
- [ ] **1. Create a Pinecone account** → [pinecone.io](https://www.pinecone.io)
  - Create index: name=`vanguard-docs`, dimensions=`3072`, metric=`cosine`, type=`serverless` (AWS)
  - Copy your API key
- [ ] **2. Get your OpenAI API key** → [platform.openai.com](https://platform.openai.com)
  - Ensure you have credits (even $5 is enough for weeks of dev)
- [ ] **3. Set up BookStack API access**
  - Log into your BookStack instance
  - Go to your profile → API Tokens → Create Token
  - Copy `Token ID` and `Token Secret`
  - Note your BookStack base URL
- [ ] **4. Configure BookStack Webhook** (for real-time sync)
  - Go to BookStack → Settings → Webhooks → Create Webhook
  - **Name:** `Vanguard Auto-Sync`
  - **Endpoint:** `https://your-backend-url/api/v1/webhook/bookstack`
  - **Events:** Select `page_create`, `page_update`, `page_delete`
  - **Active:** ✅ Yes
  - If running locally during dev, use [ngrok](https://ngrok.com) to expose your local FastAPI server
- [ ] **5. Create `.env` file** in `backend/` using the template above

### Then Build (In Order)
- [ ] Phase 1: Adapters (BookStack, Pinecone, Embedding)
- [ ] Phase 2: Ingestion Pipeline (processor, service, webhook, scheduler)
- [ ] Phase 3: RAG Chat Pipeline (LLM adapter, RAG service, wire router)
- [ ] Phase 4: Polish (logging, health checks, flip to gpt-4o)

---

## 🔑 Critical Implementation Notes

### Chunking Strategy
```
chunk_size = 800 characters (~150 words)
chunk_overlap = 200 characters
```
**Why 800?** Customer support answers are typically 1-3 paragraphs. 800 chars ensures each chunk is a self-contained troubleshooting step. Too large (2000+) = too much noise in the LLM context. Too small (200) = loses context.

### Pinecone Vector ID Format
```
"page_{bookstack_page_id}_chunk_{chunk_index}"
Example: "page_42_chunk_0", "page_42_chunk_1", "page_42_chunk_2"
```
**Why this format?** When a page is updated, you can delete ALL chunks for that page using metadata filter `{"page_id": 42}`, then re-upsert the new chunks. This prevents stale data.

### Metadata Schema (stored with each vector in Pinecone)
```json
{
  "page_id": 42,
  "page_title": "How to Reset Your Password",
  "book_id": 3,
  "book_title": "User Guide",
  "chapter_id": 7,
  "bookstack_url": "https://bookstack.example.com/books/user-guide/page/reset-password",
  "chunk_text": "To reset your password, navigate to Settings > Account...",
  "chunk_index": 0,
  "last_updated": "2026-03-16T10:30:00Z"
}
```
This metadata enables:
- **Citations in chat:** Show the original BookStack URL to the user.
- **Targeted updates:** Filter by `page_id` for page-level re-ingestion.
- **Book-level filtering:** Could later filter search to specific books.

### BookStack Webhook Payload (what your endpoint receives)
When a page is created/updated in BookStack, it sends:
```json
{
  "event": "page_update",
  "text": "Page Updated: \"Reset Password Guide\"",
  "triggered_at": "2026-03-16T10:30:00.000000Z",
  "triggered_by": { "id": 1, "name": "Admin" },
  "webhook_id": 1,
  "webhook_name": "Vanguard Auto-Sync",
  "url": "https://your-bookstack.com/books/user-guide/page/reset-password",
  "related_item": {
    "id": 42,
    "type": "page",
    "book_id": 3,
    "chapter_id": 7,
    "name": "Reset Password Guide",
    "slug": "reset-password-guide"
  }
}
```

### APScheduler Polling Logic (Pseudo-code)
```python
# Every 5 minutes:
1. Read `last_sync_timestamp` from local state (file or in-memory)
2. GET BookStack /api/pages?filter[updated_at:gt]={last_sync_timestamp}&sort=-updated_at
3. For each page in response:
   a. Fetch full page content: GET /api/pages/{id}
   b. Delete old vectors: pinecone.delete(filter={"page_id": id})
   c. Process: clean HTML → chunk → embed → upsert to Pinecone
4. Update `last_sync_timestamp` to now
```

---

## 🎯 SUMMARY: Why This Wins the Hackathon

| Feature | Why Judges Care |
|---|---|
| **Automatic pipeline** | Shows operational maturity, not just a demo hack |
| **Webhook + Polling dual strategy** | Enterprise-grade resilience |
| **Confidence-gated responses** | Prevents hallucinations — the #1 AI safety concern |
| **Streaming responses** | Sub-second perceived latency |
| **HeyGen Avatar** | Visual "wow" factor that makes demos memorable |
| **Clean Architecture** | Shows software engineering discipline |
| **BookStack as real KB** | Proves it works with actual enterprise tools, not toy data |
| **Citations with source links** | Verifiability — builds trust |

**Your stack is solid. Your architecture is sound. The missing piece is the implementation. Start with Phase 1 today.**
