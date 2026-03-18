"use client";

import { useTranslations } from "next-intl";
import { useHealthStatus, useSyncStatus } from "@/domains/system";

/**
 * Telemetry status indicators — matches original HTML bottom-of-avatar layout.
 * CORE_SYNC: ACTIVE / NEURAL_MESH: ENGAGED style.
 */
export function AvatarTelemetry() {
  const t = useTranslations("avatar");
  const ts = useTranslations("status");

  const health = useHealthStatus();
  const sync = useSyncStatus();

  const isHealthy = health.isSuccess;

  return (
    <div className="flex gap-6 mt-2">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-white/30 text-xs font-light">auto_awesome</span>
        <span className="text-[10px] font-medium text-white/30 tracking-[0.15em]">
          {t("coreSync")}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-white/30 text-xs font-light">memory</span>
        <span className="text-[10px] font-medium text-white/30 tracking-[0.15em]">
          {isHealthy ? t("meshEngaged") : ts("degraded")}
        </span>
      </div>
    </div>
  );
}
