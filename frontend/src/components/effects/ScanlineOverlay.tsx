"use client";

import { cn } from "@/lib/utils";

/* Faint scanline overlay — CRT-style ambient effect. */
export function ScanlineOverlay({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[var(--z-effects)]",
        "opacity-[0.03]",
        className,
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
      }}
    />
  );
}
