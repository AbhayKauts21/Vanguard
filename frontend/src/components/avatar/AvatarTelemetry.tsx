"use client";

import { useTranslations } from "next-intl";
import { useHealthStatus, useSyncStatus } from "@/domains/system";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";

/**
 * Telemetry status indicators — matches original HTML bottom-of-avatar layout.
 * Phase 8: Now wired to real backend status + sync state.
 */
export function AvatarTelemetry() {
  const t = useTranslations("avatar");
  const ts = useTranslations("status");

  const health = useHealthStatus();
  const sync = useSyncStatus();
  const backendStatus = useTelemetryStore((s) => s.backendStatus);

  const isHealthy = health.isSuccess;
  const isSyncing = sync.data?.status === "syncing";

  /* Derive core sync label */
  const coreSyncLabel = isSyncing ? ts("syncing") : t("coreSync");

  /* Derive mesh/backend label */
  const meshLabel = !isHealthy
    ? ts("degraded")
    : backendStatus === "online"
      ? t("meshEngaged")
      : backendStatus === "degraded"
        ? ts("degraded")
        : ts("offline");

  return (
    <div className="flex gap-6 mt-2">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-white/30 text-xs font-light">auto_awesome</span>
        <span className={`text-[10px] font-medium tracking-[0.15em] ${isSyncing ? "text-violet-400/60 animate-pulse" : "text-white/30"}`}>
          {coreSyncLabel}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-white/30 text-xs font-light">memory</span>
        <span className={`text-[10px] font-medium tracking-[0.15em] ${backendStatus === "online" ? "text-white/30" : "text-red-400/50"}`}>
          {meshLabel}
        </span>
      </div>
    </div>
  );
}
