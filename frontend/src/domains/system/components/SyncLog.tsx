"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "success" | "info" | "error";
}

function createMockLogs(): LogEntry[] {
  return [
    {
      id: "1",
      timestamp: "T-05m",
      message: "Delta sync completed (0 changes found).",
      type: "success"
    },
    {
      id: "2",
      timestamp: "T-10m",
      message: "Health check passed across 4/4 edge nodes.",
      type: "info"
    },
    {
      id: "3",
      timestamp: "T-15m",
      message: "Page 'Architecture Params' ingested successfully (7 chunks).",
      type: "success"
    }
  ];
}

export function SyncLog() {
  const [logs] = useState<LogEntry[]>(createMockLogs);
  const t = useTranslations("system");

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/40 hover:border-white/20">
      <div className="relative z-10 flex h-full flex-col">
        <h3 className="mb-4 text-lg font-medium text-white/90">{t("eventLog")}</h3>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-4 border-l-2 border-white/5 pl-4 text-sm transition-all hover:border-white/20">
              <span className="shrink-0 text-white/40">{log.timestamp}</span>
              <span className={
                log.type === "success" ? "text-emerald-300/90" :
                log.type === "error" ? "text-red-400" :
                "text-white/70"
              }>
                {log.message}
              </span>
            </div>
          ))}
          <div className="flex gap-4 border-l-2 border-indigo-500/50 pl-4 text-sm">
            <span className="shrink-0 text-white/40">{t("listening")}</span>
            <span className="text-indigo-300 animate-pulse">{t("waitingEvents")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
