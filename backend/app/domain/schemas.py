from pydantic import BaseModel, Field
from typing import List, Optional
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
    """A source citation attached to a chat response."""
    source: str
    content: str
    url: Optional[str] = None
    score: float = 0.0


class ChatRequest(BaseModel):
    """Incoming user query."""
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response with AI answer + BookStack citations."""
    answer: str
    citations: List[Citation]
    conversation_id: Optional[str] = None


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
