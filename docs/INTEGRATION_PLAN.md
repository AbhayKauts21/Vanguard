# 🔗 PROJECT VANGUARD — INTEGRATION PLAN v2.0

## CLEO: Contextual Learning & Enterprise Oracle

> **Purpose:** This document is the single source of truth for all remaining integration work required to take CLEO from "frontend + backend working independently" to a fully integrated, demo-ready product.
>
> **Date:** 2026-03-20
> **Status:** Active — All phases scoped
> **Authors:** Vanguard Team

---

## 📋 TABLE OF CONTENTS

1. [Current State Assessment](#1-current-state-assessment)
2. [Integration Architecture Overview](#2-integration-architecture-overview)
3. [Phase 1 — Critical Bug Fixes & Contract Alignment](#3-phase-1--critical-bug-fixes--contract-alignment)
4. [Phase 2 — RAG Chat End-to-End Hardening](#4-phase-2--rag-chat-end-to-end-hardening)
5. [Phase 3 — Azure Direct Chat Frontend Integration](#5-phase-3--azure-direct-chat-frontend-integration)
6. [Phase 4 — Conversation Memory & Persistence](#6-phase-4--conversation-memory--persistence)
7. [Phase 5 — Admin Dashboard & System Controls](#7-phase-5--admin-dashboard--system-controls)
8. [Phase 6 — HeyGen Interactive Avatar Integration](#8-phase-6--heygen-interactive-avatar-integration)
9. [Phase 7 — Security, Auth & Webhook Verification](#9-phase-7--security-auth--webhook-verification)
10. [Phase 8 — Observability & Telemetry](#10-phase-8--observability--telemetry)
11. [Phase 9 — Performance, Polish & Demo Readiness](#11-phase-9--performance-polish--demo-readiness)
12. [Phase 10 — Deployment & Infrastructure](#12-phase-10--deployment--infrastructure)
13. [Risk Register & Mitigations](#13-risk-register--mitigations)
14. [Dependency Map & Execution Order](#14-dependency-map--execution-order)
15. [Definition of Done — Full Integration](#15-definition-of-done--full-integration)

---

## 1. Current State Assessment

### 1.1 What's Built & Working

#### Backend (v0.2.0) — ✅ Fully Implemented
| Layer | Components | Status |
|---|---|---|
| **Adapters** | `BookStackClient`, `EmbeddingClient` (provider-backed), `LLMClient`, `VectorStore`, `AzureOpenAIClient` | ✅ All operational |
| **Services** | `RAGService`, `AzureChatService`, `IngestionService`, `TextProcessor`, `SyncScheduler` | ✅ All operational |
| **API** | `/chat/`, `/chat/stream`, `/azure-chat/`, `/admin/*`, `/webhook/bookstack`, `/health` | ✅ All 8 endpoints live |
| **Domain** | Full Pydantic schema set — BookStack, Vector, RAG, Azure, Admin, Webhook DTOs | ✅ Complete |

#### Frontend (v0.2.2) — ✅ UI Complete, Partially Integrated
| Layer | Components | Status |
|---|---|---|
| **Layout** | `AppShell`, `TopBar`, `SplitPanelLayout`, `FooterStatusBar` | ✅ Rendered |
| **Chat** | `ChatPanel`, `MessageList`, `MessageBubble`, `Composer`, `EmptyState`, `TypingIndicator` | ✅ Rendered |
| **Avatar** | `AvatarPanel`, `AvatarSphere`, `AvatarBadge`, `AvatarTelemetry` | ✅ UI shell only |
| **Effects** | `ParticleCanvas`, `ScanlineOverlay`, `GhostTerminal`, `NeuralSvgOverlay`, `LiquidFilter` | ✅ Rendered |
| **Hooks** | `useChat`, `useChatStream`, `useHealthStatus`, `useSyncStatus` | ✅ Implemented |
| **State** | Zustand chat store with full streaming lifecycle | ✅ Working |
| **i18n** | `next-intl` with `en.json` / `es.json` | ✅ Working |
| **Tests** | 52 Vitest tests, Istanbul coverage | ✅ Passing |

### 1.2 What's Broken or Missing

| # | Issue | Severity | Category |
|---|---|---|---|
| BUG-001 | `exceptions.py` — `WebhookError`, `SchedulerError`, `ConfigurationError` inherit from undefined `VanguardError` instead of `CLEOBaseError` | 🔴 Critical | Backend Bug |
| BUG-002 | Frontend `Citation` type has `source`/`title`/`url` but backend sends `page_title`/`bookstack_url`/`score` — **field name mismatch** | 🔴 Critical | Contract |
| GAP-001 | No frontend UI for Azure Direct Chat (`POST /api/v1/azure-chat/`) | 🟡 High | Integration |
| GAP-002 | No conversation memory — chat is stateless, resets on reload | 🟡 High | Feature |
| GAP-003 | No admin dashboard — ingestion/sync controls are API-only | 🟡 High | Feature |
| GAP-004 | HeyGen avatar not integrated — only config placeholder exists | 🔴 Critical | Feature |
| GAP-005 | Webhook secret configured but never verified in `router_webhook.py` | 🟡 High | Security |
| GAP-006 | No authentication on admin or webhook endpoints | 🟡 High | Security |
| GAP-007 | Nav links ("Neural Link", "Archive", "Nexus") are `#` placeholders | 🟢 Medium | UI |
| GAP-008 | No deployment configuration (Docker, CI/CD) | 🟢 Medium | Infra |
| GAP-009 | No `.env.example` in either backend or frontend | 🟢 Medium | DX |
| GAP-010 | Settings/Power buttons in TopBar are non-functional | 🟢 Low | UI |

### 1.3 Integration Readiness Score

```
Backend API Stability:     ████████████████████ 100%  — All endpoints respond
Frontend UI Completion:    ████████████████████ 100%  — All components render
Frontend↔Backend Wiring:   ████████░░░░░░░░░░░░  40%  — RAG chat works, rest missing
Contract Alignment:        ██████░░░░░░░░░░░░░░  30%  — Type mismatches exist
Security:                  ██░░░░░░░░░░░░░░░░░░  10%  — No auth, no webhook verification
Avatar Integration:        ░░░░░░░░░░░░░░░░░░░░   0%  — Shell only
Deployment Readiness:      ░░░░░░░░░░░░░░░░░░░░   0%  — No containerization
```

---

## 2. Integration Architecture Overview

### 2.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   Next.js Frontend (CLEO UI)                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ Chat     │  │ Avatar   │  │ Admin    │  │ System       │   │   │
│  │  │ Domain   │  │ Domain   │  │ Domain   │  │ Domain       │   │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │   │
│  │       │              │             │                │           │   │
│  │  ┌────▼──────────────▼─────────────▼────────────────▼───────┐  │   │
│  │  │              lib/api/client.ts (Typed Fetch)              │  │   │
│  │  └────────────────────────┬─────────────────────────────────┘  │   │
│  └───────────────────────────┼────────────────────────────────────┘   │
│                              │ HTTP / SSE / WebRTC                     │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
          ┌────────────────────▼────────────────────┐
          │         FastAPI Backend (CLEO API)       │
          │  ┌──────────┐  ┌──────────┐  ┌────────┐│
          │  │ Chat API │  │ Admin API│  │Webhook ││
          │  │ (RAG +   │  │          │  │Receiver││
          │  │  Azure)  │  │          │  │        ││
          │  └────┬─────┘  └────┬─────┘  └───┬────┘│
          │       │             │             │     │
          │  ┌────▼─────────────▼─────────────▼──┐  │
          │  │          Services Layer            │  │
          │  │ RAGService │ AzureChatService │    │  │
          │  │ IngestionService │ SyncScheduler │ │  │
          │  └────┬─────────────┬────────────────┘  │
          │       │             │                    │
          │  ┌────▼─────────────▼────────────────┐  │
          │  │         Adapters Layer             │  │
          │  │ BookStack│Pinecone│OpenAI│Azure    │  │
          │  └────┬────────┬────────┬────────┬───┘  │
          └───────┼────────┼────────┼────────┼──────┘
                  │        │        │        │
          ┌───────▼──┐ ┌──▼────┐ ┌─▼─────┐ ┌▼────────────┐
          │BookStack │ │Pinecone│ │OpenAI │ │Azure OpenAI │
          │  Wiki    │ │VectorDB│ │  API  │ │  Foundry    │
          └──────────┘ └───────┘ └───────┘ └─────────────┘
                                                │
                                           ┌────▼─────┐
                                           │  HeyGen  │
                                           │  Avatar  │
                                           │  (WebRTC)│
                                           └──────────┘
```

### 2.2 Data Flow — Integrated Chat Request

```
User types question in Composer
        │
        ▼
┌─ Frontend ─────────────────────────────────────────────────────┐
│  1. useChatStream() dispatches message                         │
│  2. Zustand store: addMessage(user) + setStreaming(true)       │
│  3. fetch(POST /api/v1/chat/stream) with AbortController      │
│  4. consumeSSEStream() processes tokens:                       │
│     - type:"token" → appendToStream(content)                  │
│     - type:"done"  → finishStream() + setCitations()          │
│  5. If avatar enabled: send final text to HeyGen SDK          │
│  6. Store conversation_id for multi-turn                      │
└────────────────────────────────────────────────────────────────┘
        │ SSE Stream
        ▼
┌─ Backend ──────────────────────────────────────────────────────┐
│  1. router_chat.py receives ChatRequest                        │
│  2. rag_service.stream_answer():                               │
│     a. embedding_client.embed_text(question) → vector          │
│     b. vector_store.query(vector, top_k=5) → chunks           │
│     c. Confidence gate: max(scores) >= 0.78?                   │
│        NO  → yield {"I don't have enough information..."}      │
│        YES → continue                                          │
│     d. prompts.build_rag_prompt(question, chunks) → prompt     │
│     e. llm_client.stream_chat(prompt) → token iterator         │
│     f. yield each token as SSE event                           │
│     g. yield citations as final SSE event                      │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 Integration Layer Contracts

All frontend↔backend communication follows these rules:

| Rule | Detail |
|---|---|
| **Protocol** | HTTP/1.1 over HTTPS (SSE for streaming) |
| **Content-Type** | `application/json` (requests), `text/event-stream` (streaming responses) |
| **Error Format** | RFC 7807 Problem Details: `{ type, title, status, detail, instance }` |
| **Auth** | API key header (future): `X-API-Key: <key>` |
| **CORS** | Backend allows frontend origin; configured in `main.py` |
| **Timeout** | Frontend: 30s for non-streaming, no timeout for SSE |
| **Abort** | Frontend uses `AbortController` for streaming cancellation |

---

## 3. Phase 1 — Critical Bug Fixes & Source Decoupling Foundation

> **Priority:** 🔴 P0 — Blocker
> **Estimated effort:** 5-7 hours (includes source abstraction)
> **Dependencies:** None — must complete first

### 3.1 BUG-001: Fix Exception Hierarchy

**Problem:** `WebhookError`, `SchedulerError`, and `ConfigurationError` in `backend/app/core/exceptions.py` inherit from `VanguardError` which doesn't exist. They should inherit from `CLEOBaseError` (or whatever the actual base class is).

**File:** `backend/app/core/exceptions.py`

**Fix:**
```python
# BEFORE (broken):
class WebhookError(VanguardError): ...
class SchedulerError(VanguardError): ...
class ConfigurationError(VanguardError): ...

# AFTER (fixed):
class WebhookError(CLEOBaseError): ...
class SchedulerError(CLEOBaseError): ...
class ConfigurationError(CLEOBaseError): ...
```

**Verification:**
- [ ] All exception classes resolve without `NameError`
- [ ] `pytest` passes with no import errors
- [ ] Webhook endpoint returns proper RFC 7807 error on invalid payload

---

### 3.1b SOURCE DECOUPLING: Build Pluggable Knowledge Source Framework

**Problem:** Currently tightly coupled to BookStack only. Adding Confluence, Notion, or GitHub requires major pipeline refactoring.

**Solution: Strategy Pattern with KnowledgeSource Interface**

Define ONE abstract interface that all sources implement:

```python
# backend/app/adapters/knowledge_source.py (NEW)

from abc import ABC, abstractmethod
from typing import Optional, List
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Document:
    """Abstract document (source-agnostic)."""
    id: str                           # "bookstack_42" or "notion_xyz"
    title: str
    content: str
    url: str
    source_type: str                  # "bookstack", "notion", "confluence"
    metadata: dict                    # Source-specific data
    last_updated: datetime
    book_id: Optional[str] = None
    book_title: Optional[str] = None

class KnowledgeSource(ABC):
    """Abstract base for ANY knowledge source."""
    
    source_type: str
    
    @abstractmethod
    async def fetch_all_documents(self) -> List[Document]:
        """Get all documents from this source."""
        pass
    
    @abstractmethod
    async def fetch_document(self, document_id: str) -> Document:
        """Get single document by ID."""
        pass
    
    @abstractmethod
    async def fetch_updated_since(self, timestamp: datetime) -> List[Document]:
        """Get documents updated since timestamp (delta sync)."""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Verify source is reachable."""
        pass
```

**Why This Design (Strategy Pattern):**
- ✅ **Open for extension:** Add BookStack + Confluence + Notion without pipeline changes
- ✅ **Closed for modification:** Ingestion pipeline never changes
- ✅ **No duplication:** Each source implements 4 methods, pipeline is generic
- ✅ **Configuration-driven:** Switch sources via env var `KNOWLEDGE_SOURCES="bookstack,confluence"`
- ✅ **Production-ready:** Single source interface supports unlimited sources

**Timeline:**
- **Day 1:** Create `KnowledgeSource` interface + refactor `BookStackSource`
- **Day 2+:** Add `ConfluenceSource`, `NotionSource`, `GitHubSource` (same pattern)

**Files to create:**
- `backend/app/adapters/knowledge_source.py` — Abstract interface + Document dataclass
- `backend/app/adapters/sources/bookstack_source.py` — Refactored BookStack implementation
- `backend/app/adapters/sources/confluence_source.py` — Template for future sources

**Files to modify:**
- `backend/app/services/ingestion_service.py` — Support multiple sources
- `backend/app/core/config.py` — Factory method for sources
- `backend/app/api/router_admin.py` — Per-source endpoints
- `backend/app/domain/schemas.py` — Add `source_type`, `source_id` to Citation

---

### 3.2 BUG-002: Align Citation Type Contract

**Problem:** Frontend and backend use different field names for the same citation data.

| Field | Backend Sends | Frontend Expects |
|---|---|---|
| Page title | `page_title` | `title` |
| URL | `bookstack_url` | `url` |
| Relevance | `score` | (not mapped) |
| Source label | (not sent) | `source` |

**Option A — Fix Frontend Types (Recommended)**
Align frontend `Citation` type to match backend response exactly. This is less disruptive since the backend contract is established.

**Files to modify:**
1. `frontend/src/types/chat.ts` — Update `Citation` interface
2. `frontend/src/domains/chat/model/types.ts` — Update any local citation types
3. `frontend/src/components/chat/MessageBubble.tsx` — Update citation rendering
4. `frontend/src/lib/api/sse-parser.ts` — Update citation parsing if mapped there
5. `frontend/src/domains/chat/hooks/useChatStream.ts` — Verify citation extraction

**Target `Citation` type:**
```typescript
export interface Citation {
  page_id: number;
  page_title: string;
  book_id: number;
  book_title: string;
  bookstack_url: string;
  chunk_text: string;
  score: number;
}
```

**Option B — Add Backend Serialization Alias**
Add response model aliases so backend sends both formats. More work, less recommended.

**Decision:** Use Option A.

**Verification:**
- [ ] Frontend `Citation` type matches backend `CitationSchema` exactly
- [ ] Citations render correctly with real backend data
- [ ] SSE `done` event citations parse without undefined fields
- [ ] Existing Vitest tests updated and passing

---

### 3.3 Create `.env.example` Files

**Files to create:**

**`backend/.env.example`:**
```env
# === Project ===
PROJECT_NAME=CLEO
DEBUG=true

# === OpenAI (RAG Generation) ===
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_PROVIDER=azure
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# === Azure OpenAI (Direct Chat) ===
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_CHAT_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=your-embedding-deployment
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# === Pinecone ===
PINECONE_API_KEY=pcsk_xxxxxxxxxxxx
PINECONE_INDEX_NAME=cleo-docs
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

# === BookStack ===
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id
BOOKSTACK_TOKEN_SECRET=your_token_secret
BOOKSTACK_WEBHOOK_SECRET=your_webhook_secret

# === Tuning ===
CHUNK_SIZE=800
CHUNK_OVERLAP=200
MIN_SIMILARITY_SCORE=0.78
SYNC_INTERVAL_MINUTES=5
TOP_K_RESULTS=5

# === HeyGen (Future) ===
HEYGEN_API_KEY=your_heygen_api_key
```

**`frontend/.env.example`:**
```env
NEXT_PUBLIC_APP_NAME=CLEO
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_SUPPORTED_LOCALES=en,es
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ENABLE_AVATAR=false
NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS=true
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_HEYGEN_AVATAR_ID=
NEXT_PUBLIC_HEYGEN_VOICE_ID=
HEYGEN_API_KEY=
```

**Verification:**
- [ ] Both `.env.example` files committed to repo
- [ ] `.gitignore` excludes `.env` but includes `.env.example`
- [ ] All settings in `.env.example` match `config.py` and `env.ts` fields

---

### 3.4 Phase 1 Acceptance Criteria

- [ ] All Python imports resolve without errors
- [ ] `pytest` runs clean (no import-time failures)
- [ ] Frontend `Citation` type aligns with backend `CitationSchema`
- [ ] Citations render correctly when real backend data is received
- [ ] `.env.example` files exist for both backend and frontend
- [ ] All 52 frontend Vitest tests still pass (with updated citation types)

**Commit:** `fix: align citation contract, fix exception hierarchy, add env examples`

---

## 3.5 Critical Edge Case Fixes (SECURITY & STABILITY)

> **Priority:** 🔴 P0 — Must be in codebase before demo
> **Estimated effort:** 3-4 hours (included in Phase 1 total: 5-7 hours)
> **Dependencies:** None — implement in parallel with 3.1-3.4

These fixes address critical issues identified in edge case analysis. **All 8 fixes must be implemented to ensure production stability.**

---

### E-001: Debounce Send Button — Prevent Duplicate Requests [CONCURRENCY]

**Problem:** User clicks send button rapidly (or double-clicks from habit) → multiple identical requests queued simultaneously → 10x API calls, chat filled with duplicates

**Real-World Scenarios:**
- Network latency (200-500ms) before response starts — user sees clickable button → clicks again
- Browser double-click behavior (from desktop app habits)
- React state batching allows race conditions
- Network retry — user clicks again if no response after 5s

**Files to modify:**
1. `frontend/src/domains/chat/hooks/useChatStream.ts` — Add guard + debounce
2. `frontend/src/components/chat/ChatComposer.tsx` — Disable send button while loading
3. `backend/app/api/router_chat.py` — Backend idempotency with request_id cache

**Implementation:**

**Frontend (Layer 1 — UX Prevention):**
```typescript
// useChatStream.ts
export function useChatStream() {
  const [isLoading, setIsLoading] = useState(false);
  const requestInFlightRef = useRef(false);  // Guard against race conditions
  
  const sendMessage = useCallback(
    async (message: string) => {
      // FIX E-001: Prevent concurrent execution
      if (requestInFlightRef.current) {
        console.warn('Request already in flight, ignoring duplicate');
        return;
      }
      
      if (!message.trim()) return;
      
      requestInFlightRef.current = true;
      setIsLoading(true);
      
      try {
        const response = await fetch('/api/v1/chat/stream', {
          method: 'POST',
          body: JSON.stringify({ message, request_id: uuid() }),
        });
        // ... handle response ...
      } finally {
        requestInFlightRef.current = false;
        setIsLoading(false);
      }
    },
    []
  );
  
  return { sendMessage, isLoading };
}
```

**Backend (Layer 2 — Idempotency):**
```python
# router_chat.py
from uuid import uuid4

class ChatRequest(BaseModel):
    message: str
    request_id: str = Field(default_factory=lambda: str(uuid4()))

recent_requests: dict[str, ChatResponse] = {}  # {request_id: response}

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    # Return cached response if already processed
    if request.request_id in recent_requests:
        return recent_requests[request.request_id]
    
    # Process request and cache result...
```

**Test Cases:**
- [ ] Button disabled while request in flight
- [ ] Double-click only sends one request
- [ ] Same `request_id` returns cached response

**Verification:**
- [ ] Debounce prevents duplicate API calls
- [ ] Send button disabled during streaming
- [ ] Backend deduplicates with request_id cache

---

### E-002: Empty Knowledge Base Handling [GRACEFUL DEGRADATION]

**Problem:** User asks question but Pinecone has 0 vectors (before ingestion) → backend crashes with IndexError

**Current Risk:** `max([r.score for r in results])` fails if results list is empty

**Files to modify:**
1. `backend/app/services/rag_service.py` — Add empty results check

**Implementation:**
```python
# rag_service.py
async def stream_answer(self, question: str):
    query_vector = await self.embedding_client.embed_text(question)
    results = await self.vector_store.query(query_vector, top_k=5)
    
    # FIX E-002: Handle empty knowledge base
    if not results:
        yield {
            "type": "done",
            "answer": "🔍 No knowledge base data found. Please run ingestion first.",
            "citations": [],
            "confidence": 0.0,
            "mode": "error",
        }
        return
    
    max_confidence = max([r.score for r in results])
    # ... continue normal flow ...
```

**Test Case:**
- [ ] Empty Pinecone query returns graceful error
- [ ] No IndexError or backend 500

**Verification:**
- [ ] User sees "No knowledge base data found" message
- [ ] Backend doesn't crash

---

### E-003: Token Limit Overflow — Dynamic History Trimming [RESOURCE MANAGEMENT]

**Problem:** 4-5 citations + 10-message history + question = exceeds token limit → LLM returns error mid-stream

**Files to modify:**
1. `backend/app/services/token_calculator.py` (NEW) — Calculate tokens upfront
2. `backend/app/services/rag_service.py` — Trim conversation history if needed

**Implementation:**
```python
# token_calculator.py (NEW)
from tiktoken import get_encoding

class TokenCalculator:
    def __init__(self):
        self.encoding = get_encoding("cl100k_base")  # GPT-4 tokenizer
    
    def count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text))
    
    def estimate_response_tokens(
        self,
        question: str,
        context_chunks: list[str],
        conversation_history: list[ConversationMessage],
    ) -> int:
        """Estimate total tokens for request + response."""
        system_tokens = self.count_tokens(SYSTEM_PROMPT)
        question_tokens = self.count_tokens(question)
        context_tokens = sum(self.count_tokens(chunk) for chunk in context_chunks)
        history_tokens = sum(self.count_tokens(msg.content) for msg in conversation_history)
        
        return system_tokens + question_tokens + context_tokens + history_tokens + 150

# rag_service.py
class RAGService:
    def __init__(self, ..., token_calculator: TokenCalculator):
        self.token_calculator = token_calculator
    
    async def stream_answer(self, question: str, conversation_history: list):
        # FIX E-003: Calculate tokens upfront
        estimated = self.token_calculator.estimate_response_tokens(
            question, context_chunks, conversation_history
        )
        
        # Dynamically trim history if needed
        while estimated > 8192 and conversation_history:
            conversation_history.pop(0)
            estimated = self.token_calculator.estimate_response_tokens(...)
        
        # Proceed with trimmed history
```

**Test Case:**
- [ ] Conversation history trimmed if token count exceeds limit
- [ ] No LLM errors from token overflow

**Verification:**
- [ ] Token calculator available in RAGService
- [ ] History dynamically trimmed based on token count

---

### E-004: Stream Disconnection — Clean Cleanup [RESOURCE CLEANUP]

**Problem:** User closes tab mid-stream → AbortController fires. Without cleanup, partial message + dangling socket

**Files to modify:**
1. `frontend/src/domains/chat/hooks/useChatStream.ts` — Proper AbortSignal handling
2. `backend/app/api/router_chat.py` — Catch CancelledError gracefully

**Implementation:**

**Frontend:**
```typescript
// useChatStream.ts
async function* streamResponse(signal: AbortSignal) {
  const response = await fetch('/api/v1/chat/stream', { signal });
  const reader = response.body?.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield JSON.parse(new TextDecoder().decode(value));
    }
  } finally {
    // FIX E-004: Cleanup on abort
    reader.releaseLock();
    logger.info('Stream cleanup completed');
  }
}
```

**Backend:**
```python
# router_chat.py
@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    try:
        async def response_generator():
            try:
                async for chunk in rag_service.stream_answer(...):
                    yield f"data: {json.dumps(chunk)}\n\n"
            except asyncio.CancelledError:
                # FIX E-004: Gracefully handle disconnection
                logger.info(f"Stream cancelled for {request.conversation_id}")
                raise  # Let framework handle cleanup
        
        return StreamingResponse(response_generator(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Stream error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
```

**Test Case:**
- [ ] Abort signal cleanup handler fires
- [ ] No dangling connections or memory leaks

**Verification:**
- [ ] Stream cleanup runs on browser tab close
- [ ] Backend logs CancelledError gracefully

---

### E-012: XSS Prevention — Sanitize Citations [SECURITY]

**Problem:** Malicious user sends `<img src=x onerror="alert('xss')">` in question → displayed in citation without escaping

**Files to modify:**
1. `frontend/src/components/chat/CitationCard.tsx` — DOMPurify sanitization
2. `backend/app/services/rag_service.py` — HTML escape in _to_citation

**Implementation:**

**Frontend:**
```typescript
// CitationCard.tsx
import DOMPurify from 'dompurify';

export function CitationCard({ citation }: CitationCardProps) {
  // FIX E-012: Sanitize user-controlled content
  const sanitizedTitle = DOMPurify.sanitize(citation.page_title);
  const sanitizedUrl = DOMPurify.sanitize(citation.bookstack_url);
  
  return (
    <a href={sanitizedUrl} target="_blank" rel="noopener noreferrer">
      {sanitizedTitle}
    </a>
  );
}
```

**Backend (Defense in Depth):**
```python
# rag_service.py
def _to_citation(self, result: VectorSearchResult) -> Citation:
    return Citation(
        page_title=self._sanitize_text(result.page_title),
        bookstack_url=self._validate_url(result.bookstack_url),
        score=round(result.score, 3),
    )

def _sanitize_text(self, text: str) -> str:
    """Remove HTML/script content."""
    import html
    return html.escape(text)

def _validate_url(self, url: str) -> str:
    """Ensure URL is safe."""
    if not url.startswith(('http://', 'https://')):
        raise ValueError(f"Invalid URL: {url}")
    return url
```

**Test Case:**
- [ ] Malicious HTML in citations is escaped
- [ ] No XSS vulnerability via citation data

**Verification:**
- [ ] DOMPurify installed as frontend dependency
- [ ] Backend sanitizes text before sending

---

### E-013: Webhook Validation — Pydantic Block Injection [SECURITY]

**Problem:** Malicious webhook payload with `page_id: "DROP TABLE pages"` could inject bad data into ingestion queue

**Files to modify:**
1. `backend/app/api/router_webhook.py` — Add Pydantic validation

**Implementation:**
```python
# router_webhook.py
from pydantic import BaseModel, validator

class BookStackWebhookPayload(BaseModel):
    """Validated webhook payload from BookStack."""
    event: str
    text: dict
    
    @validator('event')
    def event_must_be_valid(cls, v):
        # FIX E-013: Only allow expected events
        allowed = ['page-created', 'page-updated', 'page-deleted']
        if v not in allowed:
            raise ValueError(f'Invalid event: {v}')
        return v

@router.post("/webhook/bookstack")
async def bookstack_webhook(payload: BookStackWebhookPayload):
    # Payload is guaranteed valid by Pydantic
    event = payload.event
    page_id = payload.text.get('page_id')
    
    if event == 'page-updated':
        background_tasks.add_task(
            ingestion_service.re_ingest_page,
            page_id=page_id,
        )
    
    return {"status": "ok"}
```

**Test Case:**
- [ ] Invalid event type rejected with 422
- [ ] Missing/malformed payload returns validation error

**Verification:**
- [ ] Pydantic validates all webhook payloads
- [ ] Invalid events blocked at API boundary

---

### E-014: Admin Auth — Switch Tokens to Secure Sessions [SECURITY]

**Problem:** Token-based auth (visible in browser) → XSS steals token. Sessions are more secure.

**Files to modify:**
1. `backend/app/api/router_admin.py` — Switch from token to session auth
2. `backend/app/core/config.py` — Add session middleware configuration
3. `frontend/src/lib/api/client.ts` — Include credentials in admin requests

**Implementation:**

**Backend:**
```python
# router_admin.py
from fastapi.security import HTTPAuthorizationCredentials
from starlette.middleware.sessions import SessionMiddleware

app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

@router.post("/login")
async def admin_login(request: Request, password: str):
    # FIX E-014: Use session instead of token
    if password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Set secure session cookie (httponly, secure, sameSite)
    request.session["admin"] = True
    request.session["ip"] = request.client.host
    return {"status": "logged in"}

@router.post("/sync")
async def sync(request: Request):
    # Verify session exists
    if not request.session.get("admin"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify IP hasn't changed (prevent session hijacking)
    if request.client.host != request.session.get("ip"):
        raise HTTPException(status_code=401, detail="Session IP mismatch")
    
    # Run sync...
```

**Frontend:**
```typescript
// client.ts
// Include credentials to send cookies
const response = await fetch('/api/v1/admin/sync', {
  method: 'POST',
  credentials: 'include',  // Include cookies
  body: JSON.stringify({ ... }),
});
```

**Test Case:**
- [ ] Admin login sets session cookie
- [ ] Admin endpoints require valid session
- [ ] Invalid password rejects login

**Verification:**
- [ ] SessionMiddleware configured
- [ ] Admin endpoints use session auth
- [ ] Token-based auth removed

---

### E-020: Avatar Memory Leak — Proper Cleanup on Unmount [RESOURCE CLEANUP]

**Problem:** HeyGen WebRTC session not cleaned up on component unmount → memory leak

**Files to modify:**
1. `frontend/src/domains/avatar/hooks/useHeyGenAvatar.ts` — Proper cleanup in useEffect

**Implementation:**
```typescript
// useHeyGenAvatar.ts
export function useHeyGenAvatar(config: AvatarConfig) {
  const sessionRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // FIX E-020: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup function runs when component unmounts
      if (sessionRef.current) {
        sessionRef.current.disconnectStream();  // Stop WebRTC
        sessionRef.current.closeConnection();   // Close session
        sessionRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;  // Release stream
      }
      
      logger.info('Avatar session cleaned up');
    };
  }, []);
  
  const connect = async () => {
    try {
      const avatar = new StreamingAvatar({ token: sessionToken, ... });
      await avatar.createSession({ videoElement: videoRef.current });
      sessionRef.current = avatar;
    } catch (error) {
      logger.error('Avatar connection failed:', error);
    }
  };
  
  return { connect, videoRef, isConnected };
}
```

**Test Case:**
- [ ] Avatar session cleanup fires on unmount
- [ ] WebRTC stream released
- [ ] No memory leaks on component remounting

**Verification:**
- [ ] Cleanup handler in useEffect return
- [ ] Session reference cleared after disconnect

---

### 3.5 Edge Case Acceptance Criteria

- [ ] **E-001:** Send button debounced, backend request_id deduplication working
- [ ] **E-002:** Empty KB returns graceful error, no IndexError
- [ ] **E-003:** Token calculator available, history trimmed if needed
- [ ] **E-004:** Stream cleanup handler fires on abort signal
- [ ] **E-012:** DOMPurify installed, citations sanitized in frontend
- [ ] **E-013:** Pydantic validates webhook payload, invalid events rejected
- [ ] **E-014:** Admin endpoints use sessions, token auth removed
- [ ] **E-020:** Avatar cleanup handler fires on unmount, no memory leaks

**Commit:** `fix: add critical edge case handling (E-001, E-002, E-003, E-004, E-012, E-013, E-014, E-020)`

**Timeline:** 3-4 hours (parallel with Phase 1 sections 3.1-3.4)

---

## 4. Phase 2 — RAG Chat End-to-End Hardening

> **Priority:** 🔴 P0 — Core product flow
> **Estimated effort:** 4-6 hours
> **Dependencies:** Phase 1 complete

### 4.1 Verify RAG Chat Streaming E2E

The RAG streaming flow (`useChat` → SSE → Zustand → MessageBubble`) is already wired. This phase hardens it.

**Test Scenarios:**

| # | Scenario | Expected Behavior | Verified? |
|---|---|---|---|
| E2E-01 | User sends question, backend has relevant data | Stream tokens render word-by-word, citations appear at end | ☐ |
| E2E-02 | User sends question, no relevant data (low confidence) | "I don't have enough information" message, no citations | ☐ |
| E2E-03 | User sends empty message | Frontend validates, never sends request | ☐ |
| E2E-04 | Backend is down | Error state shown, user can retry | ☐ |
| E2E-05 | User cancels mid-stream (navigates away) | AbortController fires, stream closes cleanly | ☐ |
| E2E-06 | Network drops mid-stream | Error state shown after timeout, partial message preserved | ☐ |
| E2E-07 | Rapid-fire messages | Queue or debounce prevents race conditions | ☐ |
| E2E-08 | Very long response (2000+ tokens) | No UI freeze, smooth scrolling, memory stable | ☐ |
| E2E-09 | Special characters in question (unicode, HTML) | Sanitized and handled safely | ☐ |
| E2E-10 | Citation URLs open correct BookStack pages | Links target `_blank`, correct URLs | ☐ |

### 4.2 Error State Improvements

**Current state:** Generic error handling exists but needs refinement.

**Required error states in `ChatPanel`:**

| Error Type | UI Treatment | Recovery Action |
|---|---|---|
| **Network unreachable** | Red banner: "Cannot reach CLEO. Check your connection." | Auto-retry after 5s, manual retry button |
| **Backend 500** | Yellow banner: "CLEO encountered an error. Try again." | Manual retry button |
| **Confidence too low** | Normal assistant message: "I don't have enough information about that topic." | No retry needed — this is expected behavior |
| **Rate limited (429)** | Yellow banner: "Too many requests. Please wait." | Auto-retry after `Retry-After` header value |
| **Streaming aborted** | Partial message preserved with "(interrupted)" suffix | User can re-send |

**Files to modify:**
- `frontend/src/domains/chat/hooks/useChatStream.ts` — Add granular error handling
- `frontend/src/domains/chat/model/store.ts` — Add `errorType` field to state
- `frontend/src/components/chat/ChatPanel.tsx` — Render error banners
- `frontend/src/messages/en.json` + `es.json` — Add error message translations

### 4.3 Smart Citation Management Strategy

**Problem:** When responses use 4-5+ sources, showing all citations clutters the UI and confuses users.

**Solution: Tier Citations by Relevance**

Instead of showing all sources equally, we use a smart tiering system:

```
✅ PRIMARY (1-2 sources)
   - Highest relevance scores (≥0.85)
   - Actually used by LLM for answer
   - Shown prominently by default

🟡 SECONDARY (2-3 sources)
   - Good supporting context (0.70-0.85)
   - Shown but slightly dimmed
   - Provides additional context

⚫ TERTIARY (rest of sources)
   - Reference only (<0.70)
   - Hidden by default
   - "View All Sources" button expands to show
```

**Backend Implementation:**

**File:** `backend/app/services/citation_ranker.py` (NEW)

```python
from enum import Enum
from typing import List
from app.domain.schemas import VectorSearchResult, Citation

class CitationTier(str, Enum):
    PRIMARY = "primary"        # Score ≥ 0.85
    SECONDARY = "secondary"    # Score 0.70-0.85
    TERTIARY = "tertiary"      # Score < 0.70

class CitationRanker:
    """Ranks and tiers citations for optimal UX."""
    
    def __init__(self, primary_count: int = 2, secondary_count: int = 3):
        self.primary_count = primary_count
        self.secondary_count = secondary_count
    
    def rank_citations(self, results: List[VectorSearchResult]) -> dict:
        """Tier citations by relevance and deduplicate by page_id."""
        # Deduplicate by page_id
        unique_pages = {}
        for r in results:
            if r.page_id not in unique_pages or r.score > unique_pages[r.page_id].score:
                unique_pages[r.page_id] = r
        
        # Sort by score (highest first)
        sorted_results = sorted(unique_pages.values(), key=lambda x: x.score, reverse=True)
        
        # Tier them
        primary = sorted_results[:self.primary_count]
        secondary = sorted_results[self.primary_count:self.primary_count + self.secondary_count]
        
        return {
            "primary": [self._to_citation(r, CitationTier.PRIMARY) for r in primary],
            "secondary": [self._to_citation(r, CitationTier.SECONDARY) for r in secondary],
            "all_sources": [self._to_citation(r) for r in sorted_results],
            "total_sources": len(unique_pages),
            "hidden_count": max(0, len(unique_pages) - self.primary_count - self.secondary_count),
        }
```

**Update RAG Service:**

**File:** `backend/app/services/rag_service.py` (MODIFY)

```python
from app.services.citation_ranker import CitationRanker

class RAGService:
    def __init__(self):
        self.citation_ranker = CitationRanker(primary_count=2, secondary_count=3)
    
    async def answer_query_stream(self, question: str):
        relevant = self._filter_by_confidence(results)
        ranked = self.citation_ranker.rank_citations(relevant)
        
        async for token in llm_client.stream_chat(...):
            yield {"type": "token", "content": token}
        
        yield {
            "type": "done",
            "primary_citations": ranked["primary"],
            "secondary_citations": ranked["secondary"],
            "all_citations": ranked["all_sources"],
            "hidden_count": ranked["hidden_count"],
        }
```

**Update Response Schema:**

**File:** `backend/app/domain/schemas.py` (MODIFY)

```python
class Citation(BaseModel):
    source: str
    url: Optional[str] = None
    score: float = 0.0
    page_id: int = 0
    book_id: int = 0
    source_type: str = "bookstack"  # NEW: track source type
    tier: str = "tertiary"          # NEW: "primary" | "secondary" | "tertiary"

class ChatResponse(BaseModel):
    answer: str
    primary_citations: list[Citation]     # Top 1-2
    secondary_citations: list[Citation]   # Next 2-3
    all_citations: list[Citation]         # All sources
    hidden_sources_count: int = 0
```

**Files to create/modify:**
- `backend/app/services/citation_ranker.py` — New citation tiering service
- `backend/app/services/rag_service.py` — Use CitationRanker, return tiered citations
- `backend/app/domain/schemas.py` — Add `tier` and `source_type` to Citation
- `frontend/src/components/chat/CitationList.tsx` — Smart citation display with tiers
- `frontend/src/components/chat/MessageBubble.tsx` — Integrate CitationList component

### 4.4 Auto-Scroll Behavior

**Requirement:** Chat should auto-scroll to bottom when new tokens arrive, but stop auto-scrolling if user manually scrolls up to read history.

**Implementation:**
- Track `isUserScrolledUp` via scroll event listener in `MessageList`
- If `isUserScrolledUp === false`, auto-scroll on every token
- Show "↓ New messages" button when user is scrolled up and new content arrives
- Reset `isUserScrolledUp` when user clicks the button or scrolls to bottom

**File:** `frontend/src/components/chat/MessageList.tsx`

### 4.5 Phase 2 Acceptance Criteria

- [ ] All 10 E2E scenarios pass manual testing
- [ ] Error banners display for each error type with correct i18n
- [ ] Citations render with page title, book, score bar, and link
- [ ] Citation links open correct BookStack pages in new tab
- [ ] Auto-scroll works during streaming, pauses when user scrolls up
- [ ] "New messages" button appears and works
- [ ] No console errors during normal chat flow
- [ ] Memory stable after 50+ messages in a session

**Commit:** `feat(chat): harden rag streaming with error states, citations, and auto-scroll`

---

## 5. Phase 3 — Smart Routing with RAG Confidence & Honest Uncertainty

> **Priority:** 🔴 P0 — Core product quality
> **Estimated effort:** 3-4 hours
> **Dependencies:** Phase 1 complete

### 5.1 Problem Statement

The original approach relied on fragile intent detection (keyword arrays). The new approach uses **RAG confidence scores** to make intelligent routing decisions, eliminating the need for unreliable intent classification.

**Key insight:** RAG confidence already tells you everything you need to know:
- High confidence → answer is in your knowledge base
- Medium confidence → you found something but you're uncertain
- Low confidence → knowledge base doesn't cover this

### 5.2 Three-Tier Routing Strategy

Instead of a manual mode toggle, the system automatically routes based on RAG confidence:

```
User asks question
        │
        ▼
┌─────────────────────────────────┐
│  Embed question & search RAG    │
│  Get max_confidence score       │
└──────────────┬──────────────────┘
               │
     ┌─────────┼─────────┐
     │         │         │
     ▼         ▼         ▼
  ≥0.78    0.50-0.78    <0.50
     │         │         │
     ▼         ▼         ▼

┌────────┐ ┌───────────┐ ┌────────┐
│ RAG    │ │ UNCERTAIN │ │ AZURE  │
│ANSWER  │ │ + SUPPORT │ │FALLBACK│
│+ CITE  │ │ CONTACT   │ │        │
└────────┘ └───────────┘ └────────┘
```

### 5.3 Tier 1: High Confidence (≥0.78) — Use RAG with Citations

**Scenario:** "How do I reset my password?"

```
Confidence Score: 0.92 ✅

Response:
┌─────────────────────────────────────┐
│ CLEO (Knowledge Mode)               │
│                                     │
│ To reset your password:             │
│ 1. Go to Settings → Account         │
│ 2. Click "Change Password"          │
│ 3. Enter your current password      │
│ 4. Enter your new password twice    │
│                                     │
│ 📄 Password Management Guide        │
│ [View in BookStack]                 │
└─────────────────────────────────────┘
```

**What happens:**
- User sees the answer + citation immediately
- High confidence means you trust the knowledge base
- Standard RAG flow with streaming

### 5.4 Tier 2: Medium Confidence (0.50-0.78) — Be Honest About Uncertainty

**Scenario:** "What's your refund policy?"

```
Confidence Score: 0.35 ⚠️

Response:
┌─────────────────────────────────────────────────┐
│ CLEO                                            │
│                                                 │
│ ⚠️ I'm not fully confident in my answer.        │
│                                                 │
│ The question seems to be about our product,     │
│ but I don't have clear documentation on it.     │
│                                                 │
│ For accurate details, please contact:           │
│ support@andino.com                              │
│                                                 │
│ [What I found anyway: ...]  ← Optional         │
└─────────────────────────────────────────────────┘
```

**Why this tier is important:**
- You found SOMETHING but you're uncertain
- Being honest builds trust
- Directs user to support instead of guessing
- Still shows what you found (transparency)

**When this happens:**
- User asks about product feature not well-documented
- Question is ambiguous or could apply to multiple docs
- Confidence is borderline

### 5.5 Tier 3: Low Confidence (<0.50) — Fall Back to Azure General Knowledge

**Scenario:** "Explain OAuth 2.0 concepts"

```
Confidence Score: 0.12 📚

Response:
┌──────────────────────────────────────────────┐
│ CLEO (Direct Mode) ⚡                         │
│                                              │
│ OAuth 2.0 is an open authorization standard  │
│ that enables secure third-party access...    │
│                                              │
│ Key flows:                                   │
│ 1. Authorization Code Flow (most secure)     │
│ 2. Implicit Flow (legacy)                    │
│ 3. Client Credentials Flow (server-to-server)│
│                                              │
│ ⚡ General knowledge answer                  │
│    (not specific to our product)             │
└──────────────────────────────────────────────┘
```

**When this happens:**
- Question is completely general knowledge
- Nothing relevant in your knowledge base
- Azure fallback provides useful information
- User still gets an answer

### 5.6 Backend Implementation (No Intent Classifier!)

**File:** `backend/app/services/rag_service.py` (MODIFY)

Replace the entire `stream_answer()` method with confidence-based routing:

```python
async def stream_answer(
    self,
    question: str,
    conversation_history: list[ConversationMessage] = [],
) -> AsyncGenerator[dict]:
    """
    Stream RAG answer with confidence-based routing.
    
    NO intent classifier needed — RAG confidence tells us everything:
    - ≥0.78: High confidence → Use RAG + citations
    - 0.50-0.78: Medium confidence → Honest uncertainty + support contact
    - <0.50: Low confidence → Fall back to Azure general knowledge
    """
    
    # Step 1: Embed question
    query_vector = await self.embedding_client.embed_text(question)
    
    # Step 2: Search RAG
    results = await self.vector_store.query(query_vector, top_k=5)
    max_confidence = max([r.score for r in results]) if results else 0.0
    
    # Step 3: Route based ONLY on confidence
    
    if max_confidence >= 0.78:
        # ✅ HIGH CONFIDENCE: Use RAG with citations
        context_text = "\n".join([r.metadata.get('chunk_text', '') for r in results])
        
        async for token in self.llm_client.stream_chat(
            system_prompt=self._build_rag_system_prompt(),
            messages=[
                {
                    "role": "user",
                    "content": f"Context:\n{context_text}\n\nQuestion: {question}"
                }
            ]
        ):
            yield {"type": "token", "content": token}
        
        # Send citations
        citations = [
            {
                "page_id": r.metadata.get('page_id'),
                "page_title": r.metadata.get('page_title'),
                "book_id": r.metadata.get('book_id'),
                "book_title": r.metadata.get('book_title'),
                "bookstack_url": r.metadata.get('bookstack_url'),
                "chunk_text": r.metadata.get('chunk_text'),
                "score": r.score,
            }
            for r in results
        ]
        
        yield {
            "type": "done",
            "citations": citations,
            "mode_used": "rag",
            "max_confidence": max_confidence
        }
    
    elif max_confidence >= 0.50:
        # ⚠️ MEDIUM CONFIDENCE: Be honest about uncertainty
        uncertainty_message = (
            "I'm not fully confident in my answer to this question.\n\n"
            "The question seems to be about our product or policies, "
            "but I don't have clear documentation on it.\n\n"
            "For accurate details, please contact: support@andino.com"
        )
        
        yield {
            "type": "token",
            "content": uncertainty_message
        }
        
        yield {
            "type": "done",
            "citations": [],
            "mode_used": "uncertain",
            "max_confidence": max_confidence,
            "what_i_found": [
                {
                    "page_title": r.metadata.get('page_title'),
                    "score": r.score,
                }
                for r in results
            ]
        }
    
    else:
        # 📚 LOW CONFIDENCE: Fall back to Azure general knowledge
        yield from await self._stream_azure_response(question, conversation_history)

async def _stream_azure_response(
    self,
    question: str,
    conversation_history: list[ConversationMessage] = []
) -> AsyncGenerator[dict]:
    """Fall back to Azure OpenAI for general knowledge questions."""
    
    from app.services.azure_chat_service import azure_chat_service
    
    system_prompt = """You are CLEO, an AI assistant for Andino Global.
    
ABOUT ANDINO GLOBAL:
- Product: BookStack - Enterprise Documentation Platform
- Support: support@andino.com
- Features: Page versioning, role-based access, webhooks

This is a GENERAL KNOWLEDGE question not covered in our knowledge base.
Provide helpful, accurate information from your training data.
Do NOT make up details about our product features or policies."""
    
    async for token in azure_chat_service.stream_chat(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": question}]
    ):
        yield {"type": "token", "content": token}
    
    yield {
        "type": "done",
        "citations": [],
        "mode_used": "azure_fallback",
        "max_confidence": 0.0
    }
```

### 5.7 Update Response Schema

**File:** `backend/app/domain/schemas.py` (MODIFY)

Add new fields to track routing mode:

```python
class ChatResponse(BaseModel):
    answer: str
    citations: list[CitationSchema]
    mode_used: str  # NEW: "rag" | "uncertain" | "azure_fallback"
    max_confidence: float  # NEW: 0.0-1.0 confidence score
    what_i_found: list[dict] | None = None  # NEW: for uncertain mode
```

### 5.8 Frontend Changes — Show Confidence-Based Feedback

**File:** `frontend/src/components/chat/MessageBubble.tsx` (MODIFY)

```typescript
interface MessageBubbleProps {
  message: Message;
  modeUsed?: 'rag' | 'uncertain' | 'azure_fallback';
  maxConfidence?: number;
}

export function MessageBubble({ 
  message, 
  modeUsed, 
  maxConfidence 
}: MessageBubbleProps) {
  return (
    <div className={`message-bubble message-${message.role}`}>
      {/* Message content */}
      <p>{message.content}</p>
      
      {/* Tier 1: High confidence — show citations */}
      {modeUsed === "rag" && message.citations?.length > 0 && (
        <CitationList citations={message.citations} />
      )}
      
      {/* Tier 2: Uncertain — show honest deflection */}
      {modeUsed === "uncertain" && (
        <div className="uncertainty-notice">
          <span className="icon">⚠️</span>
          <p className="title">Not fully confident</p>
          <p className="description">
            I found some information but I'm not confident it answers your question.
          </p>
          <a href="mailto:support@andino.com" className="support-link">
            Contact support for accurate details →
          </a>
        </div>
      )}
      
      {/* Tier 3: Azure fallback — show mode indicator */}
      {modeUsed === "azure_fallback" && (
        <div className="mode-badge azure">
          <span className="icon">⚡</span>
          <span>General knowledge answer (not specific to our product)</span>
        </div>
      )}
      
      {/* Optional: Show confidence score as debug info */}
      {maxConfidence !== undefined && (
        <div className="confidence-debug">
          Confidence: {Math.round(maxConfidence * 100)}%
        </div>
      )}
    </div>
  );
}
```

### 5.9 Update Zustand Store

**File:** `frontend/src/domains/chat/model/store.ts` (MODIFY)

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  modeUsed?: 'rag' | 'uncertain' | 'azure_fallback';  // NEW
  maxConfidence?: number;  // NEW
  timestamp: number;
}

interface ChatState {
  messages: Message[];
  // ... existing fields
  
  // NEW: Add mode tracking
  addMessage: (message: Message) => void;
  updateLastMessageMetadata: (metadata: { 
    modeUsed: string; 
    maxConfidence: number 
  }) => void;
}
```

### 5.10 Update SSE Parser

**File:** `frontend/src/lib/api/sse-parser.ts` (MODIFY)

```typescript
interface SSEDoneEvent {
  type: 'done';
  citations: Citation[];
  mode_used: 'rag' | 'uncertain' | 'azure_fallback';  // NEW
  max_confidence: number;  // NEW
  what_i_found?: Array<{ page_title: string; score: number }>;  // NEW
}
```

### 5.11 i18n Translations

**File:** `frontend/src/messages/en.json` (ADD)

```json
{
  "chat": {
    "uncertainTitle": "Not fully confident",
    "uncertainDesc": "I found some information but I'm not confident it answers your question.",
    "contactSupport": "Contact support for accurate details →",
    "azureMode": "General knowledge answer (not specific to our product)",
    "whatIFound": "What I found anyway:"
  }
}
```

**File:** `frontend/src/messages/es.json` (ADD)

```json
{
  "chat": {
    "uncertainTitle": "No completamente seguro",
    "uncertainDesc": "Encontré información pero no estoy seguro de que responda tu pregunta.",
    "contactSupport": "Contacta a soporte para detalles precisos →",
    "azureMode": "Respuesta de conocimiento general (no específica de nuestro producto)",
    "whatIFound": "Lo que encontré de todas formas:"
  }
}
```

### 5.12 Phase 3 Acceptance Criteria

- [ ] Backend searches RAG for ALL questions
- [ ] Confidence ≥0.78 → RAG answer with citations rendered correctly
- [ ] Confidence 0.50-0.78 → "Not confident" message with support link
- [ ] Confidence <0.50 → Azure fallback answer with "General knowledge" badge
- [ ] Citations show `page_title`, `book_title`, `score`, and clickable link
- [ ] Uncertainty message shows support email (clickable mailto)
- [ ] Azure fallback has visual indicator (⚡ badge)
- [ ] No manual mode toggle needed (automatic routing works)
- [ ] Confidence scores displayed in UI (for testing/demo)
- [ ] All three paths tested manually with real questions
- [ ] i18n works in both en/es for all feedback messages

**Commit:** `feat(chat): implement confidence-based smart routing without intent classifier`

---

## 6. Phase 4 — Conversation Memory & Persistence

> **Priority:** 🟡 P1 — Critical for demo quality
> **Estimated effort:** 6-8 hours
> **Dependencies:** Phase 2 complete

### 6.1 Problem Statement

Currently, both chat modes are completely stateless:
- **Backend:** Each request is independent — no conversation history
- **Frontend:** Zustand store is in-memory, wiped on page reload

For a compelling demo, CLEO needs:
1. Multi-turn context (the LLM remembers what was said earlier)
2. Session persistence (chat survives page reload during the demo)

### 6.2 Backend — Conversation Context Window

**Strategy:** Frontend sends the last N messages as `conversation_history` in each request. Backend injects them into the LLM prompt. No database needed.

**Why client-side history?**
- No database setup required (hackathon speed)
- Frontend already has messages in Zustand
- Stateless backend is simpler to deploy
- Context window is bounded (last 10 messages max)

#### 6.2.1 Update RAG Chat Request Schema

**File:** `backend/app/domain/schemas.py`

```python
class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    conversation_history: list[ConversationMessage] = []  # NEW
    max_history: int = Field(default=10, le=20)            # NEW
```

#### 6.2.2 Update RAG Service

**File:** `backend/app/services/rag_service.py`

Modify `answer()` and `stream_answer()` to:
1. Accept `conversation_history` parameter
2. Truncate to last `max_history` messages
3. Build prompt with conversation context:

```python
def _build_messages_with_history(
    self,
    system_prompt: str,
    question: str,
    context_chunks: list[str],
    conversation_history: list[ConversationMessage],
) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (last N messages)
    for msg in conversation_history[-self.max_history:]:
        messages.append({"role": msg.role, "content": msg.content})
    
    # Add current question with RAG context
    augmented_question = f"""Context from knowledge base:
{chr(10).join(context_chunks)}

User question: {question}"""
    
    messages.append({"role": "user", "content": augmented_question})
    return messages
```

#### 6.2.3 Update Azure Chat Request Schema

**File:** `backend/app/domain/schemas.py`

```python
class AzureChatRequest(BaseModel):
    message: str
    context: dict | None = None
    conversation_history: list[ConversationMessage] = []  # NEW
```

#### 6.2.4 Update Azure Chat Service

**File:** `backend/app/services/azure_chat_service.py`

Modify `chat()` to inject conversation history into the Azure OpenAI messages array.

### 6.3 Frontend — Session Persistence

#### 6.3.1 Persist Zustand to sessionStorage

**File:** `frontend/src/domains/chat/model/store.ts`

Use Zustand's `persist` middleware with `sessionStorage`:

```typescript
import { persist } from 'zustand/middleware';

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // ... existing state and actions
    }),
    {
      name: 'cleo-chat-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        messages: state.messages,
        conversationId: state.conversationId,
        chatMode: state.chatMode,
      }),
    }
  )
);
```

**Why `sessionStorage` not `localStorage`?**
- `sessionStorage` clears when the tab closes — appropriate for demo
- `localStorage` would persist across sessions — confusing for judges

#### 6.3.2 Send History with Each Request

**File:** `frontend/src/domains/chat/hooks/useChatStream.ts`

```typescript
const sendMessage = async (message: string) => {
  const { messages } = useChatStore.getState();
  
  // Extract last 10 messages as conversation_history
  const history = messages
    .slice(-10)
    .map(msg => ({ role: msg.role, content: msg.content }));
  
  await fetch('/api/v1/chat/stream', {
    method: 'POST',
    body: JSON.stringify({
      message,
      conversation_history: history,
    }),
  });
};
```

#### 6.3.3 Conversation ID Generation

Generate a UUID on the frontend when a new chat session starts:

```typescript
// frontend/src/domains/chat/model/store.ts
import { v4 as uuidv4 } from 'uuid';

initialState: {
  conversationId: uuidv4(),
  // ...
}
```

Add a "New Chat" button that resets messages and generates a new `conversationId`.

### 6.4 New Chat / Clear History

**Component:** Add "New Chat" button to `ChatPanel` header

```
┌──────────────────────────────────────────┐
│  💬 CLEO Chat    [🧠 Knowledge ▾]  [➕]  │
│                                 New Chat │
└──────────────────────────────────────────┘
```

- Clicking "➕" clears messages, generates new `conversationId`, clears `sessionStorage`
- Confirmation dialog: "Start a new conversation? Current chat will be cleared."

### 6.5 Phase 4 Acceptance Criteria

- [ ] Backend accepts `conversation_history` in RAG and Azure chat requests
- [ ] LLM responses reference earlier messages in the conversation
- [ ] Chat survives page reload (sessionStorage persistence)
- [ ] Chat clears when tab closes (sessionStorage behavior)
- [ ] "New Chat" button clears messages and creates new session
- [ ] Conversation history is capped at 10 messages to respect token limits
- [ ] Unit tests cover history serialization and truncation

**Commit:** `feat(memory): add multi-turn conversation context and session persistence`

---

## 7. Phase 5 — Admin Dashboard & System Controls

> **Priority:** 🟡 P1 — Impressive for demo
> **Estimated effort:** 6-8 hours
> **Dependencies:** Phase 1 complete

### 7.1 Admin Panel Design

Create a slide-out panel (or dedicated route) for system administration.

**Route:** `/{locale}/admin` (protected, future auth)

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙️ CLEO System Administration                          [Close] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 SYNC STATUS                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Status:  ● IDLE                  Last Sync: 2 min ago  │    │
│  │  Pages:   142 indexed             Schedule: Every 5 min  │    │
│  │  Chunks:  1,847 vectors           Next Run: 3 min        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  🔄 SYNC CONTROLS                                                │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  Full Re-Sync    │  │  Sync Single     │                     │
│  │  (All Pages)     │  │  Page (by ID)    │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  📈 SYSTEM HEALTH                                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Backend:     ● Online   (latency: 12ms)                │    │
│  │  Pinecone:    ● Online   (vectors: 1,847)               │    │
│  │  BookStack:   ● Online   (pages: 142)                   │    │
│  │  OpenAI:      ● Online   (model: gpt-4o-mini)           │    │
│  │  Azure:       ● Online   (deployment: cleo-gpt4o)       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  📋 RECENT SYNC LOG                                              │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  10:30:12  ✅ Page "Reset Password" synced (3 chunks)   │    │
│  │  10:25:00  ✅ Delta sync completed (0 changes)          │    │
│  │  10:20:00  ✅ Delta sync completed (2 pages updated)    │    │
│  │  10:15:33  ✅ Page "API Auth Guide" synced (5 chunks)   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Files to Create

| File | Purpose |
|---|---|
| `frontend/src/app/[locale]/admin/page.tsx` | Admin page route (server component shell) |
| `frontend/src/domains/system/components/AdminPanel.tsx` | Main admin panel (client component) |
| `frontend/src/domains/system/components/SyncStatusCard.tsx` | Sync status display with auto-refresh |
| `frontend/src/domains/system/components/SyncControls.tsx` | Full sync + single page sync buttons |
| `frontend/src/domains/system/components/HealthGrid.tsx` | Service health status grid |
| `frontend/src/domains/system/components/SyncLog.tsx` | Recent sync activity log |
| `frontend/src/domains/system/api/adminApi.ts` | Admin API client functions |
| `frontend/src/domains/system/hooks/useAdminSync.ts` | Hook for triggering sync operations |
| `frontend/src/domains/system/hooks/useSyncLog.ts` | Hook for polling sync log |

### 7.3 Admin API Client

**File:** `frontend/src/domains/system/api/adminApi.ts`

```typescript
import { apiClient } from '@/lib/api/client';

export const adminApi = {
  getSyncStatus: () => 
    apiClient.get<SyncStatusResponse>('/api/v1/admin/sync/status'),
  
  triggerFullSync: () => 
    apiClient.post<SyncTriggerResponse>('/api/v1/admin/ingest'),
  
  triggerPageSync: (pageId: number) => 
    apiClient.post<SyncTriggerResponse>(`/api/v1/admin/ingest/${pageId}`),
  
  getHealth: () => 
    apiClient.get<HealthResponse>('/health'),
};
```

### 7.4 Backend Enhancement — Detailed Health Endpoint

**Current:** `GET /health` returns basic status.
**Needed:** Detailed health with per-service status.

**File:** `backend/main.py` or create `backend/app/api/router_health.py`

```python
@app.get("/health/detailed")
async def detailed_health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "pinecone": await check_pinecone_health(),
            "openai": await check_openai_health(),
            "bookstack": await check_bookstack_health(),
            "azure_openai": await check_azure_health(),
        },
        "metrics": {
            "total_vectors": await vector_store.get_stats(),
            "uptime_seconds": time.time() - START_TIME,
        }
    }
```

### 7.5 Wire TopBar Navigation

**Current:** "Neural Link", "Archive", "Nexus" are placeholder `#` links.
**Update:**

| Nav Item | Route | Purpose |
|---|---|---|
| Neural Link | `/{locale}` | Main chat (already works) |
| System | `/{locale}/admin` | Admin panel (new) |
| Archive | `#` (disabled with tooltip "Coming soon") | Future chat history |

**File:** `frontend/src/components/layout/TopBar.tsx`

### 7.6 Phase 5 Acceptance Criteria

- [ ] Admin route renders at `/{locale}/admin`
- [ ] Sync status auto-refreshes every 10 seconds
- [ ] "Full Re-Sync" button triggers `POST /api/v1/admin/ingest` and shows progress
- [ ] "Sync Single Page" accepts page ID input and triggers sync
- [ ] Health grid shows real per-service status with color indicators
- [ ] TopBar navigation links to admin panel
- [ ] Admin page is i18n-translated
- [ ] Admin actions show confirmation dialogs
- [ ] Backend detailed health endpoint returns per-service status

**Commit:** `feat(admin): add admin dashboard with sync controls and health monitoring`

---

## 8. Phase 6 — HeyGen Interactive Avatar Integration

> **Priority:** 🔴 P0 — The "wow factor" for judges
> **Estimated effort:** 10-14 hours
> **Dependencies:** Phase 2 complete (chat must work first)

### 8.1 Architecture Decision

**SDK:** `@heygen/streaming-avatar` (React SDK with WebRTC)

**Integration model:**
```
User sends message
        │
        ├──► SSE Stream → Text appears in ChatPanel
        │
        └──► Final text → HeyGen SDK → Avatar speaks the answer
                                         via WebRTC video stream
```

**Key decision:** The avatar speaks the **final complete answer**, not token-by-token. This is because:
1. HeyGen requires complete sentences for natural lip-sync
2. Token-by-token would create choppy, unnatural speech
3. Text appears instantly via streaming; avatar provides the "personality layer"

### 8.2 HeyGen Integration Flow

```
┌─ Frontend ──────────────────────────────────────────────────────────┐
│                                                                      │
│  1. App starts → Initialize HeyGen session (WebRTC handshake)        │
│     ├── StreamingAvatar.createSession({ quality: 'high' })           │
│     ├── Mount <video> element in AvatarPanel                         │
│     └── Avatar enters "idle" state (breathing, blinking)             │
│                                                                      │
│  2. User sends message → RAG stream begins                           │
│     ├── Avatar enters "listening" state (head tilt, acknowledgment)  │
│     └── Tokens accumulate in MessageBubble                           │
│                                                                      │
│  3. Stream completes → Full answer available                         │
│     ├── avatar.speak({ text: fullAnswer, voiceId: 'xxx' })           │
│     ├── Avatar enters "speaking" state (lip-sync, gestures)          │
│     └── Chat shows text while avatar speaks it aloud                 │
│                                                                      │
│  4. Avatar finishes speaking → Returns to "idle" state               │
│     └── Next question can be sent                                    │
│                                                                      │
│  5. Session cleanup on unmount                                       │
│     └── StreamingAvatar.destroySession()                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3 Files to Create/Modify

| File | Purpose |
|---|---|
| `frontend/src/domains/avatar/hooks/useHeyGenAvatar.ts` | Core hook: session management, speak, state tracking |
| `frontend/src/domains/avatar/hooks/useAvatarState.ts` | Avatar visual state machine (idle/listening/speaking/error) |
| `frontend/src/domains/avatar/api/avatarApi.ts` | Token generation (if server-side token needed) |
| `frontend/src/domains/avatar/model/types.ts` | Avatar state types, config types |
| `frontend/src/domains/avatar/model/store.ts` | Zustand store for avatar state |
| `frontend/src/components/avatar/AvatarVideo.tsx` | `<video>` mount point for WebRTC stream |
| `frontend/src/components/avatar/AvatarPanel.tsx` | **Update:** Swap sphere placeholder for live video when connected |
| `frontend/src/components/avatar/AvatarControls.tsx` | Mute/unmute, enable/disable avatar |
| `frontend/src/app/api/heygen/token/route.ts` | Next.js API route to generate HeyGen session token (keeps API key server-side) |

### 8.4 HeyGen Hook Design

**File:** `frontend/src/domains/avatar/hooks/useHeyGenAvatar.ts`

```typescript
interface UseHeyGenAvatarReturn {
  // State
  isConnected: boolean;
  isLoading: boolean;
  avatarState: 'idle' | 'listening' | 'speaking' | 'error' | 'disconnected';
  error: string | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  
  // Refs
  videoRef: RefObject<HTMLVideoElement>;
}

export function useHeyGenAvatar(config: {
  avatarId: string;
  voiceId: string;
  quality: 'low' | 'medium' | 'high';
  language: string;
}): UseHeyGenAvatarReturn {
  // Implementation:
  // 1. Create StreamingAvatar instance
  // 2. Generate session token via /api/heygen/token
  // 3. Create session with avatar config
  // 4. Attach stream to video element
  // 5. Expose speak() for chat integration
  // 6. Handle lifecycle cleanup
}
```

### 8.5 Chat ↔ Avatar Integration Point

**File:** `frontend/src/domains/chat/hooks/useChatStream.ts` (modify)

After `finishStream()` is called with the complete response:

```typescript
// After stream completes:
const fullAnswer = get().currentStreamContent;
finishStream(fullAnswer, citations);

// If avatar is connected, speak the answer
const { isConnected, speak } = useAvatarStore.getState();
if (isConnected && fullAnswer) {
  await speak(fullAnswer);
}
```

### 8.6 Avatar Feature Flag

The avatar integration must be behind a feature flag since:
- HeyGen requires API credits
- Not all dev environments will have HeyGen configured
- Demo can work with or without avatar

```typescript
// frontend/src/lib/env/index.ts
export const ENABLE_AVATAR = process.env.NEXT_PUBLIC_ENABLE_AVATAR === 'true';
```

**Behavior when disabled:**
- `AvatarPanel` shows the existing `AvatarSphere` animation (current behavior)
- No HeyGen SDK loaded (tree-shaken)
- No API calls to HeyGen

**Behavior when enabled:**
- `AvatarPanel` shows live video stream
- `AvatarSphere` is replaced by `AvatarVideo`
- Telemetry badges show real connection stats

### 8.7 Avatar Token Management

**Problem:** HeyGen API key must stay server-side.

**Solution:** Next.js API route generates session tokens:

**File:** `frontend/src/app/api/heygen/token/route.ts`

```typescript
export async function POST() {
  const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.HEYGEN_API_KEY!,
    },
  });
  
  const data = await response.json();
  return Response.json({ token: data.data.token });
}
```

### 8.8 Avatar State Machine

```
                    ┌──────────┐
                    │          │
         ┌─────────► IDLE     ◄──────────┐
         │         │(breathing)│           │
         │         └─────┬────┘           │
         │               │                │
         │          user sends            │
         │          message               │
         │               │                │
         │         ┌─────▼────┐           │
         │         │          │           │
         │         │LISTENING │      speak()
         │         │(head tilt)│     complete
         │         └─────┬────┘           │
         │               │                │
    disconnect      stream done           │
    or error        + speak()             │
         │               │                │
         │         ┌─────▼────┐           │
         │         │          │           │
         └─────────┤SPEAKING  ├───────────┘
                   │(lip-sync) │
                   └──────────┘
```

### 8.9 Phase 6 Acceptance Criteria

- [ ] HeyGen SDK initializes and establishes WebRTC session
- [ ] Avatar video renders in `AvatarPanel` (replaces sphere)
- [ ] Avatar speaks the complete answer after stream finishes
- [ ] Avatar lip-syncs naturally with spoken text
- [ ] Avatar returns to idle state after speaking
- [ ] Mute button stops avatar audio but video continues
- [ ] Feature flag: avatar disabled → sphere animation shown (existing)
- [ ] Feature flag: avatar enabled → live video shown
- [ ] HeyGen API key is server-side only (via Next.js route handler)
- [ ] Session cleanup on page unload (no leaked WebRTC connections)
- [ ] Graceful degradation: if HeyGen fails, chat still works with text only
- [ ] Error state shown if avatar connection fails
- [ ] Works in both en/es locales (avatar voice matches language)

**Commit:** `feat(avatar): integrate heygen interactive avatar with webrtc streaming`

---

## 9. Phase 7 — Security, Auth & Webhook Verification

> **Priority:** 🟡 P1 — Required for production, helpful for demo
> **Estimated effort:** 4-6 hours
> **Dependencies:** Phase 1 complete

### 9.1 Webhook Secret Verification

**Problem:** `BOOKSTACK_WEBHOOK_SECRET` is configured but never verified.

**File:** `backend/app/api/router_webhook.py`

**Implementation:**
```python
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify BookStack webhook HMAC-SHA256 signature."""
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

@router.post("/bookstack")
async def receive_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-BookStack-Signature", "")
    
    if not verify_webhook_signature(body, signature, settings.BOOKSTACK_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    # ... existing webhook handling
```

### 9.2 API Key Authentication for Admin Endpoints

**Strategy:** Simple API key auth via header for hackathon. Not production-grade, but prevents accidental access.

**File:** Create `backend/app/core/auth.py`

```python
from fastapi import Header, HTTPException
from app.core.config import settings

async def verify_admin_key(x_api_key: str = Header(...)):
    if x_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

**Apply to admin router:**
```python
# backend/app/api/router_admin.py
from app.core.auth import verify_admin_key

router = APIRouter(
    prefix="/admin",
    dependencies=[Depends(verify_admin_key)],
)
```

**Config addition:**
```python
# backend/app/core/config.py
ADMIN_API_KEY: str = "change-me-in-production"
```

### 9.3 CORS Hardening

**Current:** CORS is likely `allow_origins=["*"]` for development.

**File:** `backend/main.py`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),  # e.g., "http://localhost:3000"
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

**Config addition:**
```python
ALLOWED_ORIGINS: str = "http://localhost:3000"
```

### 9.4 Rate Limiting

**File:** `backend/main.py`

Use `slowapi` for simple rate limiting:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Apply to chat endpoints
@router.post("/")
@limiter.limit("30/minute")
async def chat(request: Request, ...):
```

### 9.5 Phase 7 Acceptance Criteria

- [ ] Webhook endpoint verifies HMAC-SHA256 signature
- [ ] Invalid webhook signatures return 401
- [ ] Admin endpoints require `X-API-Key` header
- [ ] Invalid admin API keys return 403
- [ ] CORS restricts origins to configured frontend URL
- [ ] Chat endpoints rate-limited to 30 req/min
- [ ] All security settings configurable via `.env`

**Commit:** `feat(security): add webhook verification, admin auth, cors hardening`

---

## 10. Phase 8 — Observability & Telemetry

> **Priority:** 🟢 P2 — Nice-to-have for demo, essential for debugging
> **Estimated effort:** 4-5 hours
> **Dependencies:** Phase 2 complete

### 10.1 Backend — Structured Logging

**Current:** Basic Python logging.
**Target:** Structured JSON logging with request tracing.

**Library:** `structlog` or `loguru`

**File:** Create `backend/app/core/logging.py`

**Log every pipeline step:**
```
[2026-03-20T10:30:12Z] INFO  request.received    endpoint=/chat/stream method=POST request_id=abc-123
[2026-03-20T10:30:12Z] INFO  rag.embed_query     query_length=45 request_id=abc-123
[2026-03-20T10:30:12Z] INFO  rag.vector_search   top_k=5 results=5 max_score=0.89 request_id=abc-123
[2026-03-20T10:30:12Z] INFO  rag.confidence_gate  passed=true threshold=0.78 score=0.89 request_id=abc-123
[2026-03-20T10:30:13Z] INFO  rag.generate_start  model=gpt-4o-mini tokens_context=1200 request_id=abc-123
[2026-03-20T10:30:15Z] INFO  rag.generate_done   tokens_generated=234 duration_ms=2100 request_id=abc-123
[2026-03-20T10:30:15Z] INFO  request.completed    status=200 duration_ms=2800 request_id=abc-123
```

### 10.2 Frontend — Real Telemetry in AvatarPanel

**Current:** `AvatarTelemetry` shows hardcoded values (Synapse 98.4%, Latency 2ms).
**Target:** Show real metrics from backend health/sync endpoints.

**Telemetry badges to make real:**

| Badge | Source | Update Frequency |
|---|---|---|
| **Backend Status** | `GET /health` | Every 30s (existing `useHealthStatus`) |
| **Sync Status** | `GET /api/v1/admin/sync/status` | Every 60s (existing `useSyncStatus`) |
| **Response Latency** | Measured client-side (time from send to first token) | Per-message |
| **Vector Count** | `GET /health/detailed` → `metrics.total_vectors` | Every 60s |
| **Avatar State** | HeyGen SDK connection state | Real-time |

**Files to modify:**
- `frontend/src/components/avatar/AvatarBadge.tsx` — Accept real data props
- `frontend/src/components/avatar/AvatarTelemetry.tsx` — Wire to real hooks
- `frontend/src/domains/system/hooks/useHealthStatus.ts` — Parse detailed health

### 10.3 Request ID Tracing

**Backend:** Add middleware that generates a UUID `request_id` for every request and includes it in the response header.

**File:** `backend/app/core/middleware.py`

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response
```

**Frontend:** Log `X-Request-Id` from responses for debugging correlation.

### 10.4 Phase 8 Acceptance Criteria

- [ ] Backend produces structured JSON logs for every RAG pipeline step
- [ ] Each request has a unique `request_id` in logs and response headers
- [ ] Frontend telemetry badges show real values, not hardcoded
- [ ] Response latency measured and displayed per-message
- [ ] Sync status badge updates in real-time
- [ ] Logs are parseable by standard log aggregation tools

**Commit:** `feat(telemetry): add structured logging, request tracing, live telemetry`

---

## 11. Phase 9 — Performance, Polish & Demo Readiness

> **Priority:** 🟡 P1 — Final polish
> **Estimated effort:** 4-6 hours
> **Dependencies:** All prior phases

### 11.1 Performance Optimization

| Area | Current | Target | Action |
|---|---|---|---|
| **First Contentful Paint** | Unmeasured | < 1.5s | Audit with Lighthouse, optimize imports |
| **Chat Response (TTFT)** | ~1-2s | < 1s | Verify streaming pipeline latency |
| **Particle Canvas FPS** | ~60fps | 60fps stable | Profile with Chrome DevTools, throttle if needed |
| **Bundle Size** | Unmeasured | < 300KB gzipped | Analyze with `@next/bundle-analyzer` |
| **Memory (50+ messages)** | Unmeasured | Stable | Profile heap, virtualize message list if needed |

### 11.2 Loading & Skeleton States

Add skeleton loading states for:
- [ ] Chat panel initial load
- [ ] Admin panel sync status
- [ ] Avatar connection establishing
- [ ] Health status polling

**Component:** `frontend/src/components/ui/Skeleton.tsx` (may already exist)

### 11.3 Empty & Error States

| State | Where | Design |
|---|---|---|
| **Empty chat** | `ChatPanel` | ✅ Exists (`EmptyState` component) — verify it renders correctly |
| **Backend offline** | `ChatPanel` | "CLEO is offline. Attempting to reconnect..." with pulse animation |
| **No sync data** | Admin panel | "No sync data available. Run your first sync." |
| **Avatar failed** | `AvatarPanel` | Fall back to `AvatarSphere` with "Avatar offline" badge |

### 11.4 Demo Day Configuration

Create a `demo` profile that optimizes for the best demo experience:

**File:** `backend/.env.demo`
```env
OPENAI_MODEL=gpt-4o          # Best quality model for demo
DEBUG=false                   # Cleaner logs
MIN_SIMILARITY_SCORE=0.72    # Slightly more permissive for demo questions
TOP_K_RESULTS=3              # Fewer, more relevant results
```

**File:** `frontend/.env.demo`
```env
NEXT_PUBLIC_ENABLE_AVATAR=true
NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS=true
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_API_BASE_URL=https://your-deployed-backend.com
```

### 11.5 Demo Script Test Scenarios

Run through these before demo day:

| # | Test | Expected | Pass? |
|---|---|---|---|
| DEMO-01 | Ask "How do I reset my password?" | RAG answer with citation + avatar speaks | ☐ |
| DEMO-02 | Follow-up "What if that doesn't work?" | Context-aware follow-up referencing prior answer | ☐ |
| DEMO-03 | Switch to "Direct Mode", ask a general question | Azure OpenAI answers without citations | ☐ |
| DEMO-04 | Switch language to Spanish | All UI text changes, chat continues | ☐ |
| DEMO-05 | Ask about something not in BookStack | Confidence gate: "I don't have info about that" | ☐ |
| DEMO-06 | Open admin panel, show sync status | Real data: pages indexed, last sync time | ☐ |
| DEMO-07 | Trigger manual sync of a page | Sync completes, status updates | ☐ |
| DEMO-08 | Rapid-fire 5 questions | All respond, no crashes, avatar queues answers | ☐ |
| DEMO-09 | Refresh page mid-conversation | Chat history preserved in sessionStorage | ☐ |
| DEMO-10 | Show ambient effects (particles, scanlines) | Smooth 60fps, visually impressive | ☐ |

### 11.6 Phase 9 Acceptance Criteria

- [ ] Lighthouse performance score > 80
- [ ] All 10 demo scenarios pass
- [ ] No console errors or warnings
- [ ] Loading skeletons appear for async operations
- [ ] Demo environment configs ready
- [ ] Bundle size < 300KB gzipped (JS)

**Commit:** `polish: demo readiness, performance optimization, skeleton states`

---

## 12. Phase 10 — Deployment & Infrastructure

> **Priority:** 🟢 P2 — Required for live demo
> **Estimated effort:** 4-6 hours
> **Dependencies:** Phase 9 complete

### 12.1 Dockerization

**Backend Dockerfile:**

**File:** `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend Dockerfile:**

**File:** `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### 12.2 Docker Compose

**File:** `docker-compose.yml` (project root)

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file: ./frontend/.env
    depends_on:
      backend:
        condition: service_healthy
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://backend:8000
```

### 12.3 Deployment Options

| Platform | Backend | Frontend | Cost | Setup Time | Verdict |
|---|---|---|---|---|---|
| **Railway** | ✅ Python | ✅ Next.js | Free tier | 15 min | 🏆 **Fastest** |
| **Render** | ✅ Python | ✅ Next.js | Free tier | 20 min | 🟢 Good backup |
| **Vercel + Railway** | Railway for backend | Vercel for frontend | Free tiers | 25 min | 🟢 Best for Next.js |
| **Azure App Service** | ✅ | ✅ | Student credits | 45 min | 🟡 More complex |
| **AWS (EC2 + Amplify)** | ✅ | ✅ | Free tier | 60 min | ❌ Overkill |

**Recommendation:** Deploy backend on **Railway** and frontend on **Vercel** for maximum simplicity and free tiers.

### 12.4 CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npm test
      - run: cd frontend && npm run build

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
```

### 12.5 Phase 10 Acceptance Criteria

- [ ] `docker-compose up` starts both services and they communicate
- [ ] Health check passes in Docker environment
- [ ] Backend accessible at `http://localhost:8000`
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] Frontend can reach backend from Docker network
- [ ] CI pipeline runs tests on every push
- [ ] Deployed version accessible via public URL for demo day

**Commit:** `infra: add docker, docker-compose, github actions ci`

---

## 13. Risk Register & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | HeyGen API credits exhausted during demo | 🟡 Medium | 🔴 High | Monitor usage, have avatar feature flag ready to disable. Avatar sphere fallback is visually impressive on its own. |
| R-02 | OpenAI rate limits during demo | 🟢 Low | 🔴 High | Use gpt-4o-mini for dev, flip to gpt-4o only for demo day. Have cached responses as backup. |
| R-03 | BookStack server goes down | 🟢 Low | 🟡 Medium | RAG chat works from Pinecone vectors (already ingested). Only new ingestion would fail. |
| R-04 | Citation type contract changes | 🟡 Medium | 🟡 Medium | Add integration test that validates citation shape between backend response and frontend type. |
| R-05 | SSE streaming breaks on deployment | 🟡 Medium | 🔴 High | Non-streaming `/chat/` endpoint exists as fallback. Feature flag can switch modes. |
| R-06 | WebRTC blocked by corporate firewall (demo venue) | 🟡 Medium | 🔴 High | Test at venue beforehand. Have screen recording of avatar demo as backup. |
| R-07 | Frontend bundle too large | 🟢 Low | 🟡 Medium | Lazy load effects, avatar SDK. Use `next/dynamic`. Measure with bundle analyzer. |
| R-08 | Conversation context exceeds token limit | 🟡 Medium | 🟡 Medium | Cap `conversation_history` to 10 messages. Calculate token count before sending. |
| R-09 | Pinecone free tier limits hit | 🟢 Low | 🟡 Medium | 2GB free tier = ~2-3M vectors. BookStack corpus is tiny by comparison. |
| R-10 | Demo day network is unreliable | 🟡 Medium | 🔴 High | Pre-record full demo video as backup. Deploy to cloud, don't rely on local. |

---

## 14. Dependency Map & Execution Order

### 14.1 Phase Dependencies

```
Phase 1 (Bug Fixes & Contracts)
    │
    ├──► Phase 2 (RAG Hardening)
    │        │
    │        ├──► Phase 4 (Conversation Memory)
    │        │
    │        ├──► Phase 6 (HeyGen Avatar)
    │        │
    │        └──► Phase 8 (Telemetry)
    │
    ├──► Phase 3 (Azure Chat)
    │
    ├──► Phase 5 (Admin Dashboard)
    │
    └──► Phase 7 (Security)
              │
              └──► Phase 9 (Polish)
                       │
                       └──► Phase 10 (Deployment)
```

### 14.2 Recommended Execution Timeline

| Day | Phase | Focus | Deliverable |
|---|---|---|---|
| **Day 1** | Phase 1 | Bug fixes, contract alignment | Clean foundation |
| **Day 1** | Phase 2 | RAG hardening, error states, citations | Bulletproof chat |
| **Day 2** | Phase 3 | Azure chat integration | Dual chat modes |
| **Day 2** | Phase 4 | Conversation memory | Multi-turn context |
| **Day 3** | Phase 5 | Admin dashboard | System visibility |
| **Day 3-4** | Phase 6 | HeyGen avatar | Wow factor |
| **Day 4** | Phase 7 | Security | Production readiness |
| **Day 4** | Phase 8 | Telemetry | Real metrics |
| **Day 5** | Phase 9 | Polish & demo prep | Demo perfection |
| **Day 5** | Phase 10 | Deployment | Live URL |

### 14.3 Critical Path

The absolute minimum for a working demo is:

```
Phase 1 → Phase 2 → Phase 4 → Phase 6 → Phase 9
(Bugs)    (Chat)    (Memory)   (Avatar)   (Polish)
```

Everything else (Azure chat, admin, security, telemetry, deployment) is additive but not blocking.

### 14.4 Parallel Work Streams

If the team has 2+ developers, these can run in parallel:

| Developer A (Frontend Focus) | Developer B (Backend Focus) |
|---|---|
| Phase 1: Fix frontend citation types | Phase 1: Fix exception hierarchy |
| Phase 2: Error states, auto-scroll | Phase 4: Backend conversation history |
| Phase 3: Azure chat mode UI | Phase 5: Backend detailed health endpoint |
| Phase 6: HeyGen integration | Phase 7: Webhook verification, auth |
| Phase 9: UI polish | Phase 8: Structured logging |
| — | Phase 10: Docker, CI/CD |

---

## 15. Definition of Done — Full Integration

CLEO is fully integrated when **ALL** of the following are true:

### Core Chat ✅
- [ ] User can send a message and receive a streaming RAG response
- [ ] Citations appear below assistant messages with BookStack links
- [ ] Low-confidence queries get a graceful "I don't know" response
- [ ] Conversation context carries across multiple messages
- [ ] Chat survives page reload (sessionStorage)
- [ ] "New Chat" button clears session

### Dual Chat Modes ✅
- [ ] User can toggle between "Knowledge Mode" (RAG) and "Direct Mode" (Azure)
- [ ] RAG mode uses BookStack knowledge with citations
- [ ] Direct mode uses Azure OpenAI without citations
- [ ] Mode indicator is visible at all times

### Avatar ✅
- [ ] HeyGen avatar connects via WebRTC
- [ ] Avatar speaks the complete answer after streaming finishes
- [ ] Avatar returns to idle state between answers
- [ ] Feature flag allows graceful degradation to sphere animation
- [ ] HeyGen API key is server-side only

### Admin & System ✅
- [ ] Admin panel shows real sync status, health, and controls
- [ ] Full re-sync and single page sync work from UI
- [ ] Health badges show real per-service status
- [ ] TopBar navigation works (main chat + admin)

### Security ✅
- [ ] Webhook endpoint verifies signatures
- [ ] Admin endpoints require API key
- [ ] CORS restricts to configured origins
- [ ] Rate limiting on chat endpoints

### Quality ✅
- [ ] All existing tests pass (52 frontend + backend tests)
- [ ] No console errors or warnings in production build
- [ ] Lighthouse performance > 80
- [ ] i18n works in both English and Spanish
- [ ] All demo scenarios pass (DEMO-01 through DEMO-10)

### Deployment ✅
- [ ] Docker Compose runs both services
- [ ] CI pipeline runs tests on push
- [ ] Live URL accessible for demo day

---

## 📎 Appendix A — File Change Index

Complete list of files to create or modify across all phases:

### Backend Files to Modify
| File | Phases | Changes |
|---|---|---|
| `app/core/exceptions.py` | 1 | Fix base class inheritance |
| `app/domain/schemas.py` | 1, 2, 3, 4 | Add `source_type`/`source_id` to Citation; Add `tier` field; Add `ChatResponse` with mode_used & max_confidence; Add `ConversationMessage` |
| `app/services/rag_service.py` | 2, 3, 4 | Use CitationRanker; Add confidence-based routing; Accept conversation_history; Add E-002 empty KB check; Add E-003 token calculation |
| `app/services/ingestion_service.py` | 1 | Support multiple KnowledgeSources |
| `app/services/azure_chat_service.py` | 4 | Accept and use `conversation_history` |
| `app/core/config.py` | 1, 7 | Add source factory method; Add `ADMIN_API_KEY`, `ALLOWED_ORIGINS`; Add SessionMiddleware config |
| `app/api/router_webhook.py` | 1, 7 | Add Pydantic validation (E-013); Add HMAC signature verification |
| `app/api/router_admin.py` | 1, 7 | Add per-source ingestion endpoints; Switch to session auth (E-014); Remove token auth |
| `main.py` | 1, 7, 8 | SessionMiddleware (E-014); CORS hardening, request ID middleware |

### Backend Files to Create
| File | Phase | Purpose |
|---|---|---|
| `.env.example` | 1 | Environment template |
| `app/adapters/knowledge_source.py` | 1 | Abstract KnowledgeSource interface |
| `app/adapters/sources/bookstack_source.py` | 1 | Refactored BookStack implementation |
| `app/adapters/sources/confluence_source.py` | 1 | Template for Confluence (future) |
| `app/services/citation_ranker.py` | 2 | Citation tiering and ranking service |
| `app/services/token_calculator.py` | 1 | Token counting for E-003 |
| `app/core/auth.py` | 1, 7 | Session auth + API key verification |
| `app/core/middleware.py` | 8 | Request ID middleware |
| `app/core/logging.py` | 8 | Structured logging config |
| `app/api/router_health.py` | 5 | Detailed health endpoint |
| `Dockerfile` | 10 | Container build |

### Frontend Files to Modify
| File | Phases | Changes |
|---|---|---|
| `src/types/chat.ts` | 1, 2, 3 | Fix `Citation` type; Add `tier` and `source_type` fields; Add `mode_used` and `maxConfidence` |
| `src/domains/chat/model/types.ts` | 1, 3 | Add mode tracking types |
| `src/domains/chat/model/store.ts` | 1, 2, 3, 4 | Add citation tiering; Add message metadata for mode_used/confidence; Add sessionStorage persistence; Add requestInFlightRef for E-001 |
| `src/domains/chat/hooks/useChatStream.ts` | 1, 2, 3, 4 | Add E-001 debounce & request_id; Parse tiered citations; Error handling, metadata tracking, history; Add AbortSignal cleanup for E-004 |
| `src/components/chat/ChatPanel.tsx` | 1, 2, 3 | Error banners, confidence feedback |
| `src/components/chat/MessageList.tsx` | 2 | Auto-scroll behavior |
| `src/components/chat/MessageBubble.tsx` | 1, 2, 3 | Fix citation fields; Integrate CitationList; Add mode badges; Show uncertainty |
| `src/components/chat/ChatComposer.tsx` | 1 | Disable button while loading (E-001 UX) |
| `src/components/chat/CitationCard.tsx` | 1, 2 | Add DOMPurify sanitization (E-012) |
| `src/lib/api/sse-parser.ts` | 1, 2, 3 | Parse tiered citations (primary/secondary); Parse mode_used and max_confidence |
| `src/components/avatar/AvatarPanel.tsx` | 6 | Swap sphere for video when avatar enabled |
| `src/domains/avatar/hooks/useHeyGenAvatar.ts` | 1, 6 | Add cleanup handler for E-020 memory leak |
| `src/components/avatar/AvatarTelemetry.tsx` | 8 | Wire to real metrics |
| `src/components/layout/TopBar.tsx` | 5 | Wire navigation links |
| `src/messages/en.json` | 1, 2, 3, 5, 6 | New i18n keys for all feedback, error messages |
| `src/messages/es.json` | 1, 2, 3, 5, 6 | Spanish translations |
| `src/lib/api/client.ts` | 1, 7 | Add credentials: 'include' for session auth (E-014) |

### Frontend Files to Create
| File | Phase | Purpose |
|---|---|---|
| `.env.example` | 1 | Environment template |
| `src/components/chat/CitationList.tsx` | 2 | Smart citation list with tiering (primary/secondary/view all) |
| `src/app/[locale]/admin/page.tsx` | 5 | Admin route |
| `src/domains/system/components/AdminPanel.tsx` | 5 | Admin panel shell |
| `src/domains/system/components/SyncStatusCard.tsx` | 5 | Sync status display |
| `src/domains/system/components/SyncControls.tsx` | 5 | Sync action buttons (all sources + per-source) |
| `src/domains/system/components/HealthGrid.tsx` | 5 | Health status grid (per-source health) |
| `src/domains/system/components/SyncLog.tsx` | 5 | Sync activity log |
| `src/domains/system/api/adminApi.ts` | 5 | Admin API client (multi-source endpoints) |
| `src/domains/system/hooks/useAdminSync.ts` | 5 | Admin sync hook |
| `src/domains/avatar/hooks/useAvatarState.ts` | 6 | Avatar state machine |
| `src/domains/avatar/model/store.ts` | 6 | Avatar Zustand store |
| `src/domains/avatar/model/types.ts` | 6 | Avatar types |
| `src/domains/avatar/api/avatarApi.ts` | 6 | Avatar API client |
| `src/components/avatar/AvatarVideo.tsx` | 6 | Video mount point |
| `src/components/avatar/AvatarControls.tsx` | 6 | Avatar mute/toggle |
| `src/app/api/heygen/token/route.ts` | 6 | HeyGen token generator |

### Infrastructure Files to Create
| File | Phase | Purpose |
|---|---|---|
| `docker-compose.yml` | 10 | Multi-service orchestration |
| `backend/Dockerfile` | 10 | Backend container |
| `frontend/Dockerfile` | 10 | Frontend container |
| `.github/workflows/ci.yml` | 10 | CI/CD pipeline |

---

## 📎 Appendix B — Commit Convention

All commits follow **Conventional Commits**:

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, infra, polish
Scopes: chat, avatar, admin, security, telemetry, branding
```

**Example commit sequence:**
```
fix(contracts): align citation types between frontend and backend
fix(backend): resolve exception inheritance from VanguardError to CLEOBaseError
feat(sources): implement pluggable knowledge source interface (strategy pattern)
feat(sources): add bookstack source implementation with KnowledgeSource interface
feat(citations): add smart citation ranking and tiering system (primary/secondary/tertiary)
feat(chat): implement confidence-based smart routing with three-tier strategy
feat(chat): add error banners and auto-scroll to message list
feat(memory): add multi-turn conversation context and session persistence
feat(admin): add admin dashboard with per-source sync controls and health monitoring
feat(avatar): integrate heygen interactive avatar with webrtc streaming
feat(security): add webhook verification, admin auth, cors hardening
feat(telemetry): add structured logging, request tracing, live telemetry
polish: demo readiness, performance optimization, skeleton states
infra: add docker, docker-compose, github actions ci
```

---
┌─────────────────────────────────────────────────────────────┐
│ PATTERNS IN USE:                                            │
│                                                             │
│ [STRATEGY]        KnowledgeSource + implementations        │
│ [FACTORY]         Settings.get_knowledge_sources()         │
│ [ADAPTER]         External service wrappers                │
│ [OBSERVER]        Zustand stores → subscribers             │
│ [DEPENDENCY-INJ]  Service injection in endpoints           │
│ [STATE-MACHINE]   ChatMode, Avatar states                  │
│ [SERVICE-LAYER]   Business logic in services               │
│ [STREAMING]       SSE for unbounded responses              │
│ [CONTEXT-WINDOW]  Bounded conversation history             │
│ [FEATURE-FLAG]    Enable/disable avatar, effects           │
│ [COMPOSITION]     React hooks composition                  │
│ [TODO-CIRCUIT-BREAKER] Health checks exist, explicit impl? │
│                                                             │
│ SOLID SCORES:                                              │
│ [SRP:  90%] Services mostly single-purpose                │
│ [OCP:  95%] Open for extension (sources)                  │
│ [LSP:  90%] Substitutability good                         │
│ [ISP:  85%] Interface segmentation fair                   │
│ [DIP:  95%] Depend on abstractions ✅                     │
└─────────────────────────────────────────────────────────────┘
> **This plan is a living document. Update it as phases are completed.**
>
> Last updated: 2026-03-20
> Next review: After Phase 1 completion
