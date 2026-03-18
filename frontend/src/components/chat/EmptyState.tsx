"use client";

import { useTranslations } from "next-intl";

/* Empty state — shown when no messages. Minimal, matching original theme. */
export function EmptyState() {
  const t = useTranslations("chat");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 opacity-50">
      <div className="size-16 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center">
        <div className="flex items-end h-4 gap-[1px]">
          <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.1s" }} />
          <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.3s" }} />
          <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.2s" }} />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-light text-white/80">{t("emptyState")}</h2>
        <p className="mt-1 text-sm text-white/30">{t("emptyStateHint")}</p>
      </div>
    </div>
  );
}
