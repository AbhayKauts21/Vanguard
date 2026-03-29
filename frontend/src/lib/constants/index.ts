/* Application-wide constants. */

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/* API route prefixes. */
export const API_V1 = "/api/v1";
export const CHAT_ENDPOINT = `${API_V1}/chat`;
export const CHAT_STREAM_ENDPOINT = `${API_V1}/chat/stream`;
export const CHATS_ENDPOINT = `${API_V1}/chats`;
export const DOCUMENTS_ENDPOINT = `${API_V1}/documents`;
export const ADMIN_SYNC_STATUS_ENDPOINT = `${API_V1}/admin/sync/status`;
export const ADMIN_INGEST_ENDPOINT = `${API_V1}/admin/ingest`;
export const VOICE_TTS_ENDPOINT = `${API_V1}/voice/tts`;
export const VOICE_VOICES_ENDPOINT = `${API_V1}/voice/voices`;
export const SYSTEM_EVENTS_ENDPOINT = `${API_V1}/system/events`;
export const SYSTEM_LOGS_ENDPOINT = `${API_V1}/system/logs`;
export const HEALTH_ENDPOINT = "/health";

/* SSE event types emitted by backend. */
export const SSE_TOKEN_EVENT = "token";
export const SSE_DONE_EVENT = "done";
