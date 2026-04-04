from pydantic import BaseModel, Field, field_validator, ConfigDict, EmailStr
from typing import Any, Dict, List, Optional, Literal
from datetime import datetime
from enum import Enum
from uuid import UUID


# --- Enums ---

class SyncStatus(str, Enum):
    """Tracks the state of an ingestion job."""
    IDLE = "idle"
    SYNCING = "syncing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentProviderType(str, Enum):
    BOOKSTACK = "bookstack"
    CONFLUENCE = "confluence"
    AZURE_BLOB_PDF = "azure_blob_pdf"
    OPENAPI = "openapi"
    LOCAL_FILE = "local_file"


class DocumentContentFormat(str, Enum):
    HTML = "html"
    MARKDOWN = "markdown"
    TEXT = "text"
    OPENAPI = "openapi"


class DocumentUploadStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class SyncTriggerType(str, Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    WEBHOOK = "webhook"


class WebhookEvent(str, Enum):
    """BookStack webhook event types we handle."""
    PAGE_CREATE = "page_create"
    PAGE_UPDATE = "page_update"
    PAGE_DELETE = "page_delete"


class ChatMessageSender(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


# --- BookStack Domain Models ---

class BookStackPage(BaseModel):
    """Represents a page fetched from BookStack API."""
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str
    slug: str
    html: str = ""
    book_id: int = 0
    book_slug: Optional[str] = None
    chapter_id: Optional[int] = None
    updated_at: str = ""

    @property
    def url_path(self) -> str:
        # Prefer book_slug for cleaner URLs if available
        book_ref = self.book_slug or self.book_id
        return f"/books/{book_ref}/page/{self.slug}"


class BookStackBook(BaseModel):
    """Represents a book from BookStack API."""
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str
    slug: str


class BookStackChapter(BaseModel):
    """Represents a chapter from BookStack API."""
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str
    slug: str
    book_id: int
    priority: int = 0


class BookStackTreePage(BaseModel):
    page_id: int
    name: str


class BookStackTreeChapter(BaseModel):
    chapter_id: int
    name: str
    pages: List[BookStackTreePage] = Field(default_factory=list)


class BookStackTreeBook(BaseModel):
    book_id: int
    name: str
    pages: List[BookStackTreePage] = Field(default_factory=list)
    chapters: List[BookStackTreeChapter] = Field(default_factory=list)


class BookStackTreeResponse(BaseModel):
    items: List[BookStackTreeBook] = Field(default_factory=list)


class BookStackSyncConfigRequest(BaseModel):
    enabled_book_ids: List[int] = Field(default_factory=list)
    enabled_chapter_ids: List[int] = Field(default_factory=list)
    enabled_page_ids: List[int] = Field(default_factory=list)


class BookStackSyncConfigResponse(BaseModel):
    source_key: str
    selection_mode: Literal["all", "custom"] = "all"
    enabled_book_ids: List[int] = Field(default_factory=list)
    enabled_chapter_ids: List[int] = Field(default_factory=list)
    enabled_page_ids: List[int] = Field(default_factory=list)


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
    source_url: str = ""
    book_id: int = 0
    document_uid: str = ""
    external_document_id: str = ""
    source_key: str = ""
    source_type: str = "bookstack"
    source_name: str = ""
    full_doc_text: str = ""
    document_id: str = ""
    file_name: str = ""
    user_id: str = ""
    blob_url: str = ""
    page_number: int = 0
    source: str = ""


class DocumentReference(BaseModel):
    """Provider-agnostic reference to an external document."""

    source_key: str
    provider_type: DocumentProviderType
    external_document_id: str
    external_parent_id: Optional[str] = None
    title: str = ""
    source_url: str = ""
    container_name: str = ""
    provider_updated_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NormalizedDocument(BaseModel):
    """Provider-agnostic normalized document used by sync orchestration."""

    source_key: str
    provider_type: DocumentProviderType
    external_document_id: str
    external_parent_id: Optional[str] = None
    title: str
    content: str
    content_format: DocumentContentFormat
    source_url: str = ""
    container_name: str = ""
    provider_updated_at: Optional[datetime] = None
    checksum: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    access_scope: Optional[Dict[str, Any]] = None

    @property
    def document_uid(self) -> str:
        return f"{self.source_key}:{self.external_document_id}"


# --- Chat DTOs ---

class Citation(BaseModel):
    """A source citation attached to a chat response (source-agnostic)."""
    page_id: int = 0
    page_title: str
    source_url: str = ""
    source_type: str = "bookstack"      # "bookstack", "confluence", "notion", etc.
    source_name: str = ""               # parent container: book title, space name, etc.
    source_key: str = ""
    document_uid: str = ""
    external_document_id: str = ""
    document_id: str = ""
    file_name: str = ""
    user_id: str = ""
    blob_url: str = ""
    page_number: int = 0
    chunk_text: str = ""
    score: float = 0.0
    tier: str = "tertiary"              # "primary" | "secondary" | "tertiary"


class UploadedDocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    file_name: str
    title: str
    blob_url: str
    download_url: str
    content_type: str
    file_size: int
    tags: List[str] = Field(default_factory=list)
    status: DocumentUploadStatus
    error_detail: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class UploadedDocumentListResponse(BaseModel):
    items: List[UploadedDocumentResponse] = Field(default_factory=list)


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Incoming user query."""
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None
    conversation_history: List[ConversationMessage] = Field(default_factory=list)
    max_history: int = Field(default=10, le=20)
    is_voice_mode: bool = Field(default=False)
    vibe: Optional[str] = Field(default="professional")


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


class ChatCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)


class ChatMessageCreateRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    is_voice_mode: bool = Field(default=False)
    vibe: Optional[str] = Field(default="professional")


class ChatSummaryResponse(BaseModel):
    id: UUID
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message_preview: Optional[str] = None


class ChatListResponse(BaseModel):
    items: List[ChatSummaryResponse] = Field(default_factory=list)
    has_more: bool = False


class ChatMessageResponse(BaseModel):
    id: UUID
    chat_id: UUID
    sender: ChatMessageSender
    content: str
    created_at: datetime
    primary_citations: List[Citation] = Field(default_factory=list)
    secondary_citations: List[Citation] = Field(default_factory=list)
    all_citations: List[Citation] = Field(default_factory=list)
    hidden_sources_count: int = 0
    mode_used: Optional[str] = None
    max_confidence: Optional[float] = None
    what_i_found: Optional[List[Dict[str, Any]]] = None


class ChatMessagesResponse(BaseModel):
    chat: ChatSummaryResponse
    items: List[ChatMessageResponse] = Field(default_factory=list)
    has_more: bool = False
    next_before: Optional[datetime] = None


class ChatSendResponse(BaseModel):
    chat: ChatSummaryResponse
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse


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
    conversation_history: List[ConversationMessage] = Field(default_factory=list)
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


# --- Voice / TTS DTOs ---

class TTSRequest(BaseModel):
    """Request body for the text-to-speech endpoint."""

    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize.")
    voice: Optional[str] = Field(default=None, description="Override the default Azure TTS voice name.")
    language: Optional[str] = Field(default=None, description="Language hint (e.g. en-US) for SSML.")
    sentiment: Optional[str] = Field(default=None, description="Emotional sentiment for SSML style.")
    stream: bool = Field(default=True, description="If true, return chunked streaming audio.")



# --- Auth & RBAC DTOs ---

class PermissionResponse(BaseModel):
    id: UUID
    code: str
    description: Optional[str] = None


class RoleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    permissions: List[PermissionResponse] = Field(default_factory=list)


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    roles: List[RoleResponse] = Field(default_factory=list)
    permissions: List[PermissionResponse] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=12)
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordResetRequestResponse(BaseModel):
    status: Literal["ok"] = "ok"
    detail: str


class PasswordResetConfirmResponse(BaseModel):
    status: Literal["ok"] = "ok"
    detail: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=32)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=32)


class AuthSessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_in: int
    refresh_token_expires_in: int
    user: UserResponse


class LogoutResponse(BaseModel):
    status: str = "success"
    detail: str = "Refresh token revoked."


class RoleCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=64)
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def normalize_role_name(cls, value: str) -> str:
        return value.strip().lower()


class PermissionCreateRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=128)
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("code")
    @classmethod
    def normalize_permission_code(cls, value: str) -> str:
        return value.strip().lower()


class RolePermissionAssignmentRequest(BaseModel):
    permission_ids: List[UUID] = Field(..., min_length=1)


class UserRoleAssignmentRequest(BaseModel):
    role_ids: List[UUID] = Field(..., min_length=1)


class UserListResponse(BaseModel):
    items: List[UserResponse] = Field(default_factory=list)


class RoleListResponse(BaseModel):
    items: List[RoleResponse] = Field(default_factory=list)


class PermissionListResponse(BaseModel):
    items: List[PermissionResponse] = Field(default_factory=list)


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
    is_syncing: bool
    total_pages_synced: int = 0
    total_chunks_synced: int = 0
    last_sync_at: Optional[datetime] = None
    last_sync_duration: float = 0.0
    error: Optional[str] = None
    next_sync_at: Optional[datetime] = None
    source_key: Optional[str] = None


class DocumentSyncRunSummary(BaseModel):
    source_key: str
    trigger_type: SyncTriggerType
    status: SyncStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    documents_seen: int = 0
    documents_upserted: int = 0
    documents_skipped: int = 0
    documents_deleted: int = 0
    documents_failed: int = 0


# --- Webhook DTOs ---

class WebhookTriggeredBy(BaseModel):
    """The user who triggered the BookStack webhook event."""
    id: int = 0
    name: str = ""
    slug: str = ""


class WebhookRelatedItem(BaseModel):
    """The entity that triggered the BookStack webhook.

    BookStack does NOT send a 'type' field — the entity type is
    inferred from the event name (page_create → page, book_update → book).
    We default fields to safe values so unknown keys are silently ignored.
    """
    model_config = ConfigDict(extra="ignore")

    id: int
    book_id: int = 0
    chapter_id: Optional[int] = None
    name: str = ""
    slug: str = ""
    priority: int = 0
    draft: bool = False
    revision_count: int = 0
    template: bool = False
    created_at: str = ""
    updated_at: str = ""
    created_by: Optional[WebhookTriggeredBy] = None
    updated_by: Optional[WebhookTriggeredBy] = None
    owned_by: Optional[WebhookTriggeredBy] = None


class BookStackWebhookPayload(BaseModel):
    """Incoming BookStack webhook POST body.

    Matches the exact JSON format BookStack sends:
    https://www.bookstackapp.com/docs/admin/hacking-bookstack/#webhooks
    """
    model_config = ConfigDict(extra="ignore")

    event: str
    text: str = ""
    triggered_at: str = ""
    triggered_by: Optional[WebhookTriggeredBy] = None
    triggered_by_profile_url: str = ""
    webhook_id: int = 0
    webhook_name: str = ""
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
