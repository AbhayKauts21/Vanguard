"use client";

import { useTranslations } from "next-intl";
import { useHealthStatus } from "@/domains/system";

/**
 * Phase 9: Offline banner — shown at the top of ChatPanel when backend is unreachable.
 * Pulse-animates to draw attention; auto-dismisses when connectivity resumes.
 */
export function OfflineBanner() {
  const t = useTranslations("chat");
  const health = useHealthStatus();

  /* Only show when health check has errored out */
  if (health.isSuccess || health.isLoading) return null;

  return (
    <div className="mx-8 mt-4 mb-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-300/90 shadow-lg shrink-0 animate-pulse">
      <span className="material-symbols-outlined shrink-0 text-lg">cloud_off</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium tracking-wide">{t("offlineTitle")}</span>
        <span className="text-[11px] text-amber-300/50">{t("offlineHint")}</span>
      </div>
    </div>
  );
}
