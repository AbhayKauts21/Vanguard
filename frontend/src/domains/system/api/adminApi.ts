import { api } from "@/lib/api/client";
import { env } from "@/lib/env";

/** Header sent with every admin request for Phase 7 auth. */
const adminHeaders: Record<string, string> = env.adminApiKey
  ? { "X-API-Key": env.adminApiKey }
  : {};

export interface SyncStatusResponse {
  is_syncing: boolean;
  total_pages_synced: number;
  total_chunks_synced: number;
  last_sync_at: string | null;
  last_sync_duration: number;
  error: string | null;
  next_sync_at: string | null;
}

export interface SyncTriggerResponse {
  status: string;
  pages_processed?: number;
  chunks_created?: number;
  duration_seconds?: number;
  errors?: string[];
  page_id?: number;
  error?: string | null;
}

export interface DetailedHealthResponse {
  status: "healthy" | "degraded" | "offline";
  timestamp: string;
  services: {
    pinecone: { status: "online" | "offline"; vectors: number };
    bookstack: { status: "online" | "offline"; pages: number };
    openai: { status: "online" | "offline"; model: string };
    azure_openai: { status: "online" | "offline"; deployment: string };
  };
  metrics: {
    total_vectors: number;
    uptime_seconds: number;
  };
}

export const adminApi = {
  getSyncStatus: () =>
    api.get<SyncStatusResponse>("/api/v1/admin/sync/status", adminHeaders),

  triggerFullSync: () =>
    api.post<SyncTriggerResponse>("/api/v1/admin/ingest", undefined, adminHeaders),

  triggerPageSync: (pageId: number) =>
    api.post<SyncTriggerResponse>(`/api/v1/admin/ingest/${pageId}`, undefined, adminHeaders),

  getDetailedHealth: () => api.get<DetailedHealthResponse>("/health/detailed"),
};
