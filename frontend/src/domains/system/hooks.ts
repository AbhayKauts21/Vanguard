"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchSyncStatus } from "@/domains/chat/api";

/* Poll backend health every 30s. */
export function useHealthStatus() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/* Poll sync status every 60s. */
export function useSyncStatus() {
  return useQuery({
    queryKey: ["syncStatus"],
    queryFn: fetchSyncStatus,
    refetchInterval: 60_000,
    retry: 1,
  });
}
