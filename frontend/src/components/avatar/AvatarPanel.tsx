"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AvatarTelemetry } from "./AvatarTelemetry";
import { AvatarBadge } from "./AvatarBadge";
import { AvatarSphere } from "./AvatarSphere";
import { AvatarVideo } from "./AvatarVideo";
import { useDetailedHealth } from "@/domains/system/hooks/useDetailedHealth";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";
import { env } from "@/lib/env";

/**
 * Avatar panel — right-side container.
 * Grid overlay, sphere with concentric rings, floating badges outside the sphere,
 * CLEO-01 title positioned below the sphere (non-overlapping).
 */
export function AvatarPanel() {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Phase 8: poll /health/detailed for real metrics */
  useDetailedHealth();
  const lastLatencyMs = useTelemetryStore((s) => s.lastLatencyMs);
  const vectorCount = useTelemetryStore((s) => s.vectorCount);

  /* Format latency for badge display */
  const latencyDisplay = lastLatencyMs !== null
    ? lastLatencyMs < 1000
      ? `${lastLatencyMs}ms`
      : `${(lastLatencyMs / 1000).toFixed(1)}s`
    : "—";

  /* Format vector count compactly */
  const vectorDisplay = vectorCount !== null
    ? vectorCount >= 1000
      ? `${(vectorCount / 1000).toFixed(1)}k`
      : `${vectorCount}`
    : "—";

  /* Parallax: badges + sphere drift slightly with mouse for depth */
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const core = document.getElementById("avatar-liquid-core");
      if (!core) return;
      const coreX = (e.clientX - window.innerWidth / 2) * 0.05;
      const coreY = (e.clientY - window.innerHeight / 2) * 0.05;
      core.style.transform = `translate(${coreX}px, ${coreY}px) scale(1.15)`;

      /* Badge parallax — opposite direction for depth illusion */
      const badges = document.querySelectorAll<HTMLDivElement>(".avatar-badge");
      badges.forEach((badge) => {
        const bx = (e.clientX - window.innerWidth / 2) * -0.02;
        const by = (e.clientY - window.innerHeight / 2) * -0.02;
        badge.style.transform = `translate(${bx}px, ${by}px)`;
      });
    }
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <div
      ref={panelRef}
      className="h-full w-full rounded-xl border border-white/10 bg-black/40 overflow-hidden relative glass-panel flex items-center justify-center panel-boundary"
      id="avatar-layer"
      style={{ zIndex: 101 }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />

      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Sphere + badges section — flex-1 to take available space above title */}
      <div className="relative z-10 flex-1 w-full flex items-center justify-center">
        {/* Sphere / Context Avatar Video overlay */}
        {env.enableAvatar ? <AvatarVideo /> : <AvatarSphere />}

        {/* Floating Latency badge — real TTFT from last message */}
        <AvatarBadge
          label="Latency"
          value={latencyDisplay}
          className="absolute top-[12%] right-[8%]"
          animationDelay="-1.5s"
        />

        {/* Floating Vectors badge — real Pinecone vector count */}
        <AvatarBadge
          label="Vectors"
          value={vectorDisplay}
          className="absolute bottom-[25%] left-[5%]"
          animationDelay="-4s"
        />
      </div>

      {/* Bottom section — CLEO-01 title + telemetry */}
      <div className="absolute bottom-0 left-0 right-0 p-10 flex justify-between items-end bg-gradient-to-t from-black via-black/20 to-transparent" style={{ zIndex: 102 }}>
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
