import { api } from "@/lib/api";
import { CHAT_ENDPOINT, HEALTH_ENDPOINT, ADMIN_SYNC_STATUS_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, ChatResponse, HealthResponse, SyncStatusResponse } from "@/types";

/* Send a non-streaming chat message. */
export async function sendChatMessage(body: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>(`${CHAT_ENDPOINT}/`, body);
}

/* Fetch backend health status. */
export async function fetchHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>(HEALTH_ENDPOINT);
}

/* Fetch sync status from admin endpoint. */
export async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  return api.get<SyncStatusResponse>(ADMIN_SYNC_STATUS_ENDPOINT);
}
