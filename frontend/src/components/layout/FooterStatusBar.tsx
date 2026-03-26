"use client";

import { useTranslations } from "next-intl";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";

function formatVectorCount(value: number | null) {
  if (value === null) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

function formatLatency(value: number | null) {
  if (value === null) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value}ms`;
}

/**
 * Footer bar — live system strip instead of placeholder copy.
 */
export function FooterStatusBar() {
  const t = useTranslations("footer");
  const ts = useTranslations("status");
  const vectorCount = useTelemetryStore((s) => s.vectorCount);
  const avgLatencyMs = useTelemetryStore((s) => s.avgLatencyMs);
  const backendStatus = useTelemetryStore((s) => s.backendStatus);

  return (
    <footer className="px-10 py-4 flex justify-between border-t border-white/5 glass-panel z-50">
      <div className="flex gap-8 items-center">
        <MetricPill label={t("vectorsLabel")} value={formatVectorCount(vectorCount)} />
        <MetricPill label={t("backendLabel")} value={ts(backendStatus)} />
        <MetricPill label={t("latencyLabel")} value={formatLatency(avgLatencyMs)} />
      </div>

      <div className="text-[9px] font-medium text-white/10 uppercase tracking-[0.3em]">
        {t("buildInfo")}
      </div>
    </footer>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
      <span className="text-[9px] uppercase font-medium tracking-[0.22em] text-white/25">
        {label}
      </span>
      <span className="text-[10px] uppercase font-semibold tracking-[0.14em] text-white/65">
        {value}
      </span>
    </div>
  );
}
