"use client";

import {
  MoodOverlay,
  HexGridBackground,
  ParticleCanvas,
  ScanlineOverlay,
} from "@/components/effects";
import type { ReactNode } from "react";

/* Full-screen shell with the same ambient layer order as the Stitch reference. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden font-display text-white min-h-screen selection:bg-white/20">
      <MoodOverlay />
      <HexGridBackground />
      <ParticleCanvas />
      <ScanlineOverlay />

      {children}
    </div>
  );
}
