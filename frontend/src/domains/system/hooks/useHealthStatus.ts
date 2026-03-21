import { useState, useCallback, useEffect } from "react";
import { adminApi, DetailedHealthResponse } from "../api/adminApi";

export function useHealthStatus() {
  const [health, setHealth] = useState<DetailedHealthResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const data = await adminApi.getDetailedHealth();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to check system health");
      setHealth({
        status: "offline",
        timestamp: new Date().toISOString(),
        services: {
          pinecone: { status: "offline", vectors: 0 },
          bookstack: { status: "offline", pages: 0 },
          openai: { status: "offline", model: "unknown" },
          azure_openai: { status: "offline", deployment: "unknown" },
        },
        metrics: { total_vectors: 0, uptime_seconds: 0 },
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    health,
    isChecking,
    error,
    checkHealth,
  };
}
