"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type DetailedHealthResponse } from "@/domains/system/api/adminApi";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";

/**
 * Polls /health/detailed every 60s and syncs real metrics
 * (vector count, backend status) into the telemetry Zustand store.
 */
export function useDetailedHealth() {
  const setVectorCount = useTelemetryStore((s) => s.setVectorCount);
  const setBackendStatus = useTelemetryStore((s) => s.setBackendStatus);

  const query = useQuery<DetailedHealthResponse>({
    queryKey: ["healthDetailed"],
    queryFn: adminApi.getDetailedHealth,
    refetchInterval: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) {
      const vectorCount =
        query.data.metrics.total_vectors ||
        query.data.services.pinecone.vectors ||
        0;
      setVectorCount(vectorCount);
      setBackendStatus(query.data.status === "healthy" ? "online" : "degraded");
    } else if (query.isError) {
      setBackendStatus("offline");
    }
  }, [query.data, query.isError, setVectorCount, setBackendStatus]);

  return query;
}
