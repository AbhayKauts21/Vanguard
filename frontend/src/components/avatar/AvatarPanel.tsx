"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AvatarTelemetry } from "./AvatarTelemetry";
import { AvatarBadge } from "./AvatarBadge";
import { AvatarSphere } from "./AvatarSphere";

/**
 * Avatar panel — right-side container.
 * Grid overlay, sphere with concentric rings, floating badges outside the sphere,
 * CLEO-01 title positioned below the sphere (non-overlapping).
 */
export function AvatarPanel() {
  const t = useTranslations("avatar");
  const panelRef = useRef<HTMLDivElement>(null);

  /* Parallax: badges + sphere drift slightly with mouse for depth */
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const core = document.getElementById("avatar-liquid-core");
      if (!core) return;
      const coreX = (e.clientX - window.innerWidth / 2) * 0.04;
      const coreY = (e.clientY - window.innerHeight / 2) * 0.04;
      core.style.transform = `translate(${coreX}px, ${coreY}px) scale(1.1)`;

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
      className="h-full w-full rounded-xl border border-white/10 bg-black/40 overflow-hidden relative glass-panel flex flex-col items-center justify-center panel-boundary"
      id="avatar-layer"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />

      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Sphere + badges section — flex-1 to take available space above title */}
      <div className="relative z-10 flex-1 w-full flex items-center justify-center">
        {/* Sphere */}
        <AvatarSphere />

        {/* Floating Synapse badge — top right, outside sphere */}
        <AvatarBadge
          label="Synapse"
          value="98.4%"
          className="absolute top-[12%] right-[8%]"
          animationDelay="-1.5s"
        />

        {/* Floating Latency badge — mid left, outside sphere */}
        <AvatarBadge
          label="Latency"
          value="2ms"
          className="absolute bottom-[25%] left-[5%]"
          animationDelay="-4s"
        />
      </div>

      {/* Bottom section — CLEO-01 title + telemetry. Separated from sphere. */}
      <div className="relative z-10 w-full px-10 pb-8 pt-4 bg-gradient-to-t from-black via-black/60 to-transparent">
        <h1 className="text-4xl font-extralight tracking-[0.4em] text-white/90 uppercase">
          CLEO-01
        </h1>
        <AvatarTelemetry />
      </div>
    </div>
  );
}
