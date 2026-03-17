/* Shared frontend type definitions aligned with backend schemas. */

/* --- Chat --- */
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface Citation {
  page_id: number;
  page_title: string;
  page_url: string;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  conversation_id?: string;
}

/* --- SSE stream events --- */
export interface SSETokenEvent {
  type: "token";
  content: string;
}

export interface SSEDoneEvent {
  type: "done";
  citations: Citation[];
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

/* --- RFC 7807 error --- */
export interface ProblemDetail {
  type: string;
  title: string;
  detail?: string;
  status: number;
  instance?: string;
}
