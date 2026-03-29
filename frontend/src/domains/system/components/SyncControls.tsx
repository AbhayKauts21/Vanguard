"use client";

import { useAdminSync } from "../hooks/useAdminSync";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export function SyncControls() {
  const { triggerFullSync, triggerPageSync, isTriggering } = useAdminSync();
  const [pageId, setPageId] = useState("");
  const [notify, setNotify] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotify({ message, type });
    setTimeout(() => setNotify(null), 3000);
  };

  const handleFullSync = async () => {
    try {
      const res = await triggerFullSync();
      showNotification(`Re-sync triggered: ${res.status}`, "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showNotification(message, "error");
    }
  };

  const handleSingleSync = async () => {
    if (!pageId) return;
    try {
      const res = await triggerPageSync(parseInt(pageId));
      showNotification(`Page setup updated: ${res.status}`, "success");
      setPageId("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showNotification(message, "error");
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/40 hover:border-white/20">
      <div className="relative z-10 flex flex-col gap-6">
        <div>
          <h3 className="mb-2 text-lg font-medium text-white/90">Manual Overrides</h3>
          <p className="text-sm text-white/50">Dispatches forced ingestion into Pinecone.</p>
        </div>

        <button
          onClick={handleFullSync}
          disabled={isTriggering}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50"
        >
          {isTriggering && (
            <svg className="h-4 w-4 animate-spin text-white/70" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          Trigger Full Re-Sync
        </button>

        <div className="flex gap-2">
          <input
            type="number"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            disabled={isTriggering}
            placeholder="Page ID"
            className="w-full flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
          />
          <button
            onClick={handleSingleSync}
            disabled={isTriggering || !pageId}
            className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-all hover:bg-indigo-500/30 active:scale-95 disabled:opacity-50"
          >
            Sync
          </button>
        </div>

        {notify && (
          <div
            className={cn(
              "absolute bottom-4 left-4 right-4 rounded-lg p-3 text-center text-sm transition-all animate-in fade-in slide-in-from-bottom-2",
              notify.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}
          >
            {notify.message}
          </div>
        )}
      </div>
    </div>
  );
}
