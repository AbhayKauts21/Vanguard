"use client";

import { useAdminSync } from "../hooks/useAdminSync";
import { formatDistanceToNow } from "date-fns";

export function SyncStatusCard() {
  const { syncStatus, isRefreshing, error } = useAdminSync();

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/50 hover:border-white/20">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white/90">Pinecone Sync Status</h3>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {syncStatus?.is_syncing ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500"></span>
                </>
              ) : (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                </>
              )}
            </span>
            <span className="text-sm text-white/60">
              {syncStatus?.is_syncing ? "Syncing..." : "Idle"}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
            <div className="text-sm text-white/50">Indexed Pages</div>
            <div className="mt-1 text-2xl font-light text-white">
              {syncStatus?.total_pages_synced ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
            <div className="text-sm text-white/50">Vector Chunks</div>
            <div className="mt-1 text-2xl font-light text-white">
              {syncStatus?.total_chunks_synced ?? "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-white/40">
          <div>
            Last Sync:{" "}
            {syncStatus?.last_sync_at
              ? formatDistanceToNow(new Date(syncStatus.last_sync_at), { addSuffix: true })
              : "Never"}
          </div>
          <div>
            {isRefreshing && <span className="animate-pulse">Refreshing...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
