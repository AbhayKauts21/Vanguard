"use client";

import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { ParticleCanvas, ScanlineOverlay, HexGridBackground, GhostTerminalOverlay } from "@/components/effects";
import type { ReactNode } from "react";

/* Full-screen shell with ambient effect layer support. */
export function AppShell({ children }: { children: ReactNode }) {
  const showEffects = env.enableAmbientEffects;

  return (
    <div className={cn("relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--cleo-bg-primary)]")}>
      {/* Ambient effects layer — behind all content. */}
      {showEffects && (
        <>
          <HexGridBackground />
          <ParticleCanvas />
          <ScanlineOverlay />
          <GhostTerminalOverlay />
        </>
      )}

      {children}
    </div>
  );
}
