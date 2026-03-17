"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui";

/* Neural avatar display shell — placeholder until HeyGen integration. */
export function AvatarPanel() {
  const t = useTranslations("avatar");

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      {/* Ambient background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--cleo-cyan)]/3 via-transparent to-[var(--cleo-purple)]/3" />

      {/* Avatar core — concentric rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring */}
        <div className="animate-slow-spin absolute h-56 w-56 rounded-full border border-[var(--cleo-cyan)]/10" />
        {/* Middle ring */}
        <div
          className="animate-slow-spin absolute h-40 w-40 rounded-full border border-[var(--cleo-purple)]/15"
          style={{ animationDirection: "reverse", animationDuration: "15s" }}
        />
        {/* Inner glow */}
        <div className="animate-breathe h-24 w-24 rounded-full border border-[var(--cleo-cyan)]/20 bg-[var(--cleo-cyan)]/5" />

        {/* Center label */}
        <span className="absolute text-xs font-bold tracking-widest text-[var(--cleo-cyan)]/40">
          CLEO
        </span>
      </div>

      {/* Telemetry badges */}
      <div className="absolute bottom-6 flex flex-col items-center gap-2">
        <StatusBadge status="online" label={t("coreSync")} />
        <StatusBadge status="online" label={t("meshEngaged")} />
      </div>

      {/* Corner metrics */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--cleo-text-muted)]">
          {t("systemReady")}
        </span>
      </div>
    </div>
  );
}
