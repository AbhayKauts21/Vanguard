import { api } from "@/lib/api";
import {
  ADMIN_SYNC_STATUS_ENDPOINT,
  CHAT_ENDPOINT,
  CHATS_ENDPOINT,
  HEALTH_ENDPOINT,
} from "@/lib/constants";
import type {
  ChatListResponse,
  ChatMessagesResponse,
  ChatRequest,
  ChatResponse,
  ChatSendResponse,
  HealthResponse,
  SyncStatusResponse,
} from "@/types";

/* Send a non-streaming chat message. */
export async function sendChatMessage(body: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>(`${CHAT_ENDPOINT}/`, body);
}

export async function createPersistedChat(title?: string): Promise<ChatMessagesResponse["chat"]> {
  return api.post<ChatMessagesResponse["chat"]>(`${CHATS_ENDPOINT}/`, title ? { title } : undefined);
}

export async function listPersistedChats(limit = 50): Promise<ChatListResponse> {
  return api.get<ChatListResponse>(`${CHATS_ENDPOINT}/?limit=${limit}`);
}

export async function getPersistedChatMessages(chatId: string): Promise<ChatMessagesResponse> {
  return api.get<ChatMessagesResponse>(`${CHATS_ENDPOINT}/${chatId}/messages`);
}

export async function sendPersistedChatMessage(
  chatId: string,
  message: string,
): Promise<ChatSendResponse> {
  return api.post<ChatSendResponse>(`${CHATS_ENDPOINT}/${chatId}/messages`, { message });
}

/* Fetch backend health status. */
export async function fetchHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>(HEALTH_ENDPOINT);
}

/* Fetch sync status from admin endpoint. */
export async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  return api.get<SyncStatusResponse>(ADMIN_SYNC_STATUS_ENDPOINT);
}
