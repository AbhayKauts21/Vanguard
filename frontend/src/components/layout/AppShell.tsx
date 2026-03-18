"use client";

import {
  MoodOverlay,
  PlasmaBackground,
  GhostTerminalOverlay,
  ParticleCanvas,
  ScanlineOverlay,
  NeuralSvgOverlay,
  LiquidFilter,
} from "@/components/effects";
import type { ReactNode } from "react";

/**
 * Full-screen shell with ambient effect layers.
 * Layer order matches original HTML: mood → plasma → hex → ghost → particles → scanline → neural-svg.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden font-display text-white min-h-screen selection:bg-white/20">
      {/* Ambient layers — behind all content */}
      <MoodOverlay />
      <PlasmaBackground />
      <GhostTerminalOverlay />
      <ParticleCanvas />
      <ScanlineOverlay />
      <NeuralSvgOverlay />

      {/* Content */}
      {children}

      {/* Hidden SVG defs for liquid displacement filter */}
      <LiquidFilter />
    </div>
  );
}
