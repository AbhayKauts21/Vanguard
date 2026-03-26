"use client";

import { useTranslations } from "next-intl";
import { useSyncStatus } from "@/domains/system";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";

/**
 * Telemetry status indicators — matches original HTML bottom-of-avatar layout.
 * Phase 8: Now wired to real backend status + sync state.
 */
export function AvatarTelemetry() {
  const t = useTranslations("avatar");
  const ts = useTranslations("status");

  const sync = useSyncStatus();
  const vectorCount = useTelemetryStore((s) => s.vectorCount);

  const isSyncing = sync.data?.status === "syncing";
  const coreSyncLabel = isSyncing ? ts("syncing") : t("coreSync");
  const knowledgeLabel =
    vectorCount && vectorCount > 0 ? t("knowledgeReady") : t("knowledgeSyncing");

  return (
    <div className="flex gap-6 mt-2">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-white/30 text-xs font-light">auto_awesome</span>
        <span className={`text-[10px] font-medium tracking-[0.15em] ${isSyncing ? "text-violet-400/60 animate-pulse" : "text-white/30"}`}>
          {coreSyncLabel}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-white/30 text-xs font-light">dataset</span>
        <span className="text-[10px] font-medium tracking-[0.15em] text-white/30">
          {knowledgeLabel}
        </span>
      </div>
    </div>
  );
}
