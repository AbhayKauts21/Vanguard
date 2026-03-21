from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum


# --- Enums ---

class SyncStatus(str, Enum):
    """Tracks the state of an ingestion job."""
    IDLE = "idle"
    SYNCING = "syncing"
    COMPLETED = "completed"
    FAILED = "failed"


class WebhookEvent(str, Enum):
    """BookStack webhook event types we handle."""
    PAGE_CREATE = "page_create"
    PAGE_UPDATE = "page_update"
    PAGE_DELETE = "page_delete"


# --- BookStack Domain Models ---

class BookStackPage(BaseModel):
    """Represents a page fetched from BookStack API."""
    id: int
    name: str
    slug: str
    html: str = ""
    book_id: int = 0
    chapter_id: int = 0
    updated_at: str = ""

    @property
    def url_path(self) -> str:
        return f"/books/{self.book_id}/page/{self.slug}"


class BookStackBook(BaseModel):
    """Represents a book from BookStack API."""
    id: int
    name: str
    slug: str


# --- Vector / Chunk Models ---

class TextChunk(BaseModel):
    """A single chunk of text ready for embedding."""
    chunk_id: str          # "page_{id}_chunk_{index}"
    text: str
    metadata: dict         # page_id, title, book_id, url, etc.


class VectorSearchResult(BaseModel):
    """A single result returned from Pinecone similarity search."""
    chunk_id: str
    score: float
    text: str
    page_id: int
    page_title: str = ""
    bookstack_url: str = ""
    book_id: int = 0


# --- Chat DTOs ---

class Citation(BaseModel):
    """A source citation attached to a chat response (source-agnostic)."""
    page_id: int = 0
    page_title: str
    source_url: str = ""
    source_type: str = "bookstack"      # "bookstack", "confluence", "notion", etc.
    source_name: str = ""               # parent container: book title, space name, etc.
    chunk_text: str = ""
    score: float = 0.0
    tier: str = "tertiary"              # "primary" | "secondary" | "tertiary"


class ChatRequest(BaseModel):
    """Incoming user query."""
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response with AI answer + BookStack citations."""
    answer: str
    primary_citations: List[Citation] = Field(default_factory=list)
    secondary_citations: List[Citation] = Field(default_factory=list)
    all_citations: List[Citation] = Field(default_factory=list)
    hidden_sources_count: int = 0
    mode_used: str = "rag"
    max_confidence: float = 0.0
    what_i_found: Optional[List[Dict[str, Any]]] = None
    conversation_id: Optional[str] = None


class AzureChatParams(BaseModel):
    """Optional generation controls for direct Azure chat."""

    temperature: float = Field(0.2, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1)


class AzureChatRequest(BaseModel):
    """Stateless direct-chat request for Azure OpenAI."""

    conversation_id: Optional[str] = Field(default=None, max_length=200)
    prompt: str = Field(..., min_length=1, max_length=8_000)
    input_text: Optional[str] = Field(default=None, max_length=12_000)
    context: Dict[str, Any] = Field(default_factory=dict)
    params: AzureChatParams = Field(default_factory=AzureChatParams)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AzureChatUsage(BaseModel):
    """Normalized token usage values returned from Azure when available."""

    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class AzureChatResponse(BaseModel):
    """Normalized response for direct Azure chat requests."""

    conversation_id: Optional[str] = None
    output_text: str
    deployment: str
    request_id: Optional[str] = None
    usage: Optional[AzureChatUsage] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AzureChatMessage(BaseModel):
    """Outbound message sent to Azure OpenAI."""

    model_config = ConfigDict(extra="forbid")

    role: str
    content: str


# --- Ingestion DTOs ---

class IngestionResult(BaseModel):
    """Result of a single page ingestion."""
    page_id: int
    page_title: str
    chunks_created: int
    status: str = "success"


class FullSyncResult(BaseModel):
    """Result of a full BookStack→Pinecone sync."""
    total_pages: int
    pages_processed: int
    total_chunks: int
    failed_pages: List[int] = []
    duration_seconds: float = 0.0
    status: SyncStatus = SyncStatus.COMPLETED


class SyncStatusResponse(BaseModel):
    """Current state of the auto-sync system."""
    status: SyncStatus
    last_sync_at: Optional[datetime] = None
    next_sync_at: Optional[datetime] = None
    pages_in_index: int = 0


# --- Webhook DTOs ---

class WebhookRelatedItem(BaseModel):
    """The entity that triggered the BookStack webhook."""
    id: int
    type: str = "page"
    book_id: int = 0
    chapter_id: int = 0
    name: str = ""
    slug: str = ""


class BookStackWebhookPayload(BaseModel):
    """Incoming BookStack webhook POST body."""
    event: str
    text: str = ""
    triggered_at: str = ""
    url: str = ""
    related_item: Optional[WebhookRelatedItem] = None

    @field_validator("event")
    @classmethod
    def event_must_be_valid(cls, v: str) -> str:
        """E-013: Only allow known BookStack webhook event types."""
        allowed = {e.value for e in WebhookEvent}
        if v not in allowed:
            raise ValueError(
                f"Invalid webhook event '{v}'. Allowed: {', '.join(sorted(allowed))}"
            )
        return v
