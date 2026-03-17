"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui";
import { useHealthStatus, useSyncStatus } from "@/domains/system";

/* Telemetry panel — live health & sync badges on the avatar panel. */
export function AvatarTelemetry() {
  const t = useTranslations("avatar");
  const ts = useTranslations("status");

  const health = useHealthStatus();
  const sync = useSyncStatus();

  const isHealthy = health.isSuccess;
  const isSyncing = sync.data?.status === "syncing";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Health badge */}
      <StatusBadge
        status={isHealthy ? "online" : "offline"}
        label={isHealthy ? ts("healthy") : ts("degraded")}
      />

      {/* Sync badge */}
      <StatusBadge
        status={isSyncing ? "syncing" : "online"}
        label={isSyncing ? ts("syncing") : t("coreSync")}
      />

      {/* Page count */}
      {sync.data && (
        <span className="text-[9px] font-mono text-[var(--cleo-text-muted)]">
          PAGES: {sync.data.total_pages} | CHUNKS: {sync.data.total_chunks}
        </span>
      )}
    </div>
  );
}
