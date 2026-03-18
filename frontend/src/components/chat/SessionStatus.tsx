"use client";

import { useTranslations } from "next-intl";

/**
 * Status bar at top of chat panel — matches original HTML.
 * Uplink dot + status text, Ctrl+K hint, session ID.
 */
export function SessionStatus() {
  const t = useTranslations("chat");

  return (
    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
      <div className="flex items-center gap-3">
        <div className="size-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-pulse" />
        <span className="text-[10px] font-medium text-white/60 tracking-[0.2em] uppercase">
          {t("sessionStable")}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[9px] text-white/30 font-mono tracking-widest uppercase">
          Ctrl+K: Terminal
        </span>
        <span className="text-[9px] text-white/30 font-mono tracking-widest">
          SESSION_721_CLEO
        </span>
      </div>
    </div>
  );
}
