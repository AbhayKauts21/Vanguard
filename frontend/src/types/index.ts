/* Shared frontend type definitions aligned with backend schemas. */

/* --- Chat --- */
export interface ChatRequest {
  message: string;
  conversation_id?: string;
  conversation_history?: { role: string; content: string }[];
}

export interface ChatSummary {
  id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview?: string | null;
}

export interface Citation {
  page_id: number;
  page_title: string;
  source_url: string;
  source_type: string;        // "bookstack" | "confluence" | "notion" | etc.
  source_name: string;        // parent container: book title, space name, etc.
  document_id?: string;
  file_name?: string;
  user_id?: string;
  blob_url?: string;
  page_number?: number;
  chunk_text: string;
  score: number;
  tier?: "primary" | "secondary" | "tertiary";
}

export interface ChatResponse {
  answer: string;
  primary_citations: Citation[];
  secondary_citations: Citation[];
  all_citations: Citation[];
  hidden_sources_count: number;
  mode_used: 'rag' | 'uncertain' | 'azure_fallback';
  max_confidence: number;
  what_i_found?: { page_title: string; score: number; source_url?: string }[];
  conversation_id?: string;
}

export interface ChatListResponse {
  items: ChatSummary[];
  has_more: boolean;
}

export interface PersistedChatMessage {
  id: string;
  chat_id: string;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
  primary_citations: Citation[];
  secondary_citations: Citation[];
  all_citations: Citation[];
  hidden_sources_count: number;
  mode_used?: "rag" | "uncertain" | "azure_fallback" | null;
  max_confidence?: number | null;
  what_i_found?: { page_title: string; score: number; source_url?: string }[] | null;
}

export interface ChatMessagesResponse {
  chat: ChatSummary;
  items: PersistedChatMessage[];
  has_more: boolean;
  next_before?: string | null;
}

export interface ChatSendResponse {
  chat: ChatSummary;
  user_message: PersistedChatMessage;
  assistant_message: PersistedChatMessage;
}

/* --- SSE stream events --- */
export interface SSETokenEvent {
  type: "token";
  content: string;
}

export interface SSEDoneEvent {
  type: "done";
  primary_citations: Citation[];
  secondary_citations: Citation[];
  all_citations: Citation[];
  hidden_sources_count: number;
  mode_used: 'rag' | 'uncertain' | 'azure_fallback';
  max_confidence: number;
  what_i_found?: { page_title: string; score: number; source_url?: string }[];
  chat_summary?: ChatSummary;
}

export type SSEEvent = SSETokenEvent | SSEDoneEvent;

/* --- Admin / Sync --- */
export interface SyncStatusResponse {
  status: "idle" | "syncing" | "completed" | "failed";
  last_sync_at: string | null;
  total_pages: number;
  total_chunks: number;
  next_run_at: string | null;
}

export interface HealthResponse {
  status: string;
  project: string;
}

/* --- Auth / RBAC --- */
export interface Permission {
  id: string;
  code: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
}

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  roles: Role[];
  permissions: Permission[];
}

export interface AuthSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  access_token_expires_in: number;
  refresh_token_expires_in: number;
  user: AuthUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface StatusMessageResponse {
  status: string;
  detail: string;
}

/* --- RFC 7807 error --- */
export interface ProblemDetail {
  type: string;
  title: string;
  detail?: string;
  status: number;
  instance?: string;
}

export type DocumentUploadStatus = "pending" | "processing" | "ready" | "failed";

export interface UploadedDocument {
  id: string;
  user_id: string;
  file_name: string;
  title: string;
  blob_url: string;
  download_url: string;
  content_type: string;
  file_size: number;
  tags: string[];
  status: DocumentUploadStatus;
  error_detail?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadedDocumentListResponse {
  items: UploadedDocument[];
}
