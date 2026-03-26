"use client";

import { AvatarBadge } from "./AvatarBadge";
import { AvatarTelemetry } from "./AvatarTelemetry";
import { EnergyCoreCanvas } from "./EnergyCoreCanvas";
import { ResponseWaveform } from "./ResponseWaveform";
import { useEnergyCoreState } from "@/domains/avatar/hooks/useEnergyCoreState";
import { useDetailedHealth } from "@/domains/system/hooks/useDetailedHealth";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";

const CORE_STATUS = {
  idle: {
    className: "text-blue-300/90 border-blue-400/30",
    label: "[IDLE]",
  },
  syncing: {
    className: "text-amber-300/90 border-amber-400/30",
    label: "[SYNCING]",
  },
  speech: {
    className: "text-emerald-300/90 border-emerald-400/30",
    label: "[SPEECH_ACTIVE]",
  },
} as const;

/**
 * Avatar panel — the CLEO energy core visualizer and supporting telemetry shell.
 */
export function AvatarPanel() {
  useDetailedHealth();
  const coreState = useEnergyCoreState();
  const lastLatencyMs = useTelemetryStore((s) => s.lastLatencyMs);
  const vectorCount = useTelemetryStore((s) => s.vectorCount);

  const latencyDisplay = lastLatencyMs !== null
    ? lastLatencyMs < 1000
      ? `${lastLatencyMs}ms`
      : `${(lastLatencyMs / 1000).toFixed(1)}s`
    : "2ms";
  const vectorDisplay = vectorCount !== null
    ? vectorCount >= 1000
      ? `${(vectorCount / 1000).toFixed(1)}k`
      : `${vectorCount}`
    : "—";

  const currentStatus = CORE_STATUS[coreState];

  return (
    <div
      className="h-full w-full rounded-xl border border-white/8 bg-black overflow-hidden relative glass-panel flex items-center justify-center panel-boundary"
      id="avatar-layer"
      style={{ zIndex: 101 }}
    >
      <EnergyCoreCanvas state={coreState} />

      <div className="pointer-events-none absolute inset-px rounded-[inherit]">
        <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-xl border-l border-t border-white/20" />
        <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-xl border-b border-r border-white/20" />
      </div>

      <div className="absolute left-10 top-10 z-20 flex flex-col gap-2">
        <div
          className={`rounded-[4px] border bg-black/50 px-3 py-1 font-mono text-[10px] tracking-[0.2em] backdrop-blur-[10px] transition-all duration-500 ${currentStatus.className}`}
          id="core-status-tag"
        >
          {currentStatus.label}
        </div>
        <ResponseWaveform />
      </div>

      <AvatarBadge
        label="Vectors"
        value={vectorDisplay}
        className="absolute right-10 top-10 z-20"
        animationDelay="-1.5s"
      />

      <AvatarBadge
        label="Latency"
        value={latencyDisplay}
        className="absolute bottom-24 right-10 z-20"
        animationDelay="-4s"
      />

      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between bg-gradient-to-t from-black via-black/10 to-transparent p-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-5xl font-extralight tracking-[0.4em] text-white/90 uppercase">
            CLEO-01
          </h1>
          <AvatarTelemetry />
        </div>
      </div>
    </div>
  );
}
