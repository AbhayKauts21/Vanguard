"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { EnergyCoreKnowledgeMode } from "@/domains/avatar/model/energy-core-telemetry";

interface AvatarModeStripProps {
  mode: EnergyCoreKnowledgeMode;
  confidence: number;
  isStreaming: boolean;
}

export function AvatarModeStrip({
  mode,
  confidence,
  isStreaming,
}: AvatarModeStripProps) {
  const t = useTranslations("avatar");

  const badges = useMemo(() => {
    const nextBadges: { label: string; tone: string }[] = [];

    if (isStreaming) {
      nextBadges.push({
        label: t("streamingMode"),
        tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200/90",
      });
    }

    if (mode === "grounded") {
      nextBadges.push({
        label: t("ragMode"),
        tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100/90",
      });
      nextBadges.push({
        label: t("groundedMode"),
        tone: "border-white/14 bg-white/[0.05] text-white/70",
      });
    } else if (mode === "uncertain") {
      nextBadges.push({
        label: t("uncertainMode"),
        tone: "border-amber-400/30 bg-amber-400/10 text-amber-100/90",
      });
    } else if (mode === "fallback") {
      nextBadges.push({
        label: t("fallbackMode"),
        tone: "border-blue-400/30 bg-blue-400/10 text-blue-100/90",
      });
    }

    nextBadges.push({
      label: `${t("confidenceLabel")} ${Math.round(confidence * 100)}%`,
      tone: "border-white/12 bg-black/45 text-white/65",
    });

    return nextBadges;
  }, [confidence, isStreaming, mode, t]);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${badge.tone}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
