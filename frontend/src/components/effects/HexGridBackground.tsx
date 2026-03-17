"use client";

import { cn } from "@/lib/utils";

/* Hex grid background pattern — subtle neural mesh aesthetic. */
export function HexGridBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[var(--z-effects)] opacity-[0.02]",
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(0, 210, 255, 0.15) 1px, transparent 1px)`,
        backgroundSize: "30px 30px",
      }}
    />
  );
}
