import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { SYSTEM_EVENTS_ENDPOINT, SYSTEM_LOGS_ENDPOINT } from "@/lib/constants";

export interface AuditEvent {
  id: string;
  event_code: number;
  timestamp: string;
  description: string;
  status: string;
  context: Record<string, any>;
}

export function useAuditStream() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial fetch of recent logs
    const fetchRecentLogs = async () => {
      try {
        const data = await api.get<AuditEvent[]>(`${SYSTEM_LOGS_ENDPOINT}?limit=20`);
        setEvents(data);
      } catch (error) {
        console.error("Failed to fetch initial audit logs:", error);
      }
    };

    fetchRecentLogs();

    // Setup SSE connection
    const eventSource = new EventSource(`${env.apiBaseUrl}${SYSTEM_EVENTS_ENDPOINT}`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const newEvent: AuditEvent = JSON.parse(event.data);
        setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      } catch (error) {
        console.error("Failed to parse audit event:", error);
      }
    };

    // Named event listener if yield includes "event": "audit_log"
    eventSource.addEventListener("audit_log", (event: MessageEvent) => {
      try {
        const newEvent: AuditEvent = JSON.parse(event.data);
        setEvents((prev) => [newEvent, ...prev].slice(0, 50));
      } catch (error) {
        console.error("Failed to parse audit_log event:", error);
      }
    });

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { events, isConnected };
}
