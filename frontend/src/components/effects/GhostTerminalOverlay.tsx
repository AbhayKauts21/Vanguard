"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* Simulated terminal-style text that types itself in the background. */
const GHOST_LINES = [
  "> initializing neural mesh...",
  "> bookstack uplink: ACTIVE",
  "> vector store: CONNECTED",
  "> embedding pipeline: READY",
  "> confidence threshold: 0.78",
  "> cleo kernel: ONLINE",
];

export function GhostTerminalOverlay({ className }: { className?: string }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < GHOST_LINES.length) {
        setLines((prev) => [...prev.slice(-4), GHOST_LINES[idx]]);
        idx++;
      } else {
        idx = 0;
        setLines([]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (lines.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-12 left-4 z-[var(--z-effects)]",
        "flex flex-col gap-0.5 font-mono",
        className,
      )}
    >
      {lines.map((line, i) => (
        <span
          key={`${i}-${line}`}
          className="animate-fade-in-up text-[9px] text-[var(--cleo-cyan)]/15"
        >
          {line}
        </span>
      ))}
    </div>
  );
}
