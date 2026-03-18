"use client";

import { useEffect, useRef } from "react";

/**
 * Ghost terminal — rapidly regenerating random characters in the background.
 * Matches original HTML: 5000 chars, refreshes every 100ms, monospace.
 */
export function GhostTerminalOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<>[]{}/-=_+";

    function generateCode() {
      let str = "";
      for (let i = 0; i < 5000; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
        if (i % 120 === 0) str += "\n";
      }
      if (ref.current) ref.current.innerText = str;
    }

    const interval = setInterval(generateCode, 100);
    generateCode();

    return () => clearInterval(interval);
  }, []);

  return <div ref={ref} className="ghost-terminal" />;
}
