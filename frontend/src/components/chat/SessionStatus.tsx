"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/domains/chat/model";

/**
 * Status bar at top of chat panel — matches original HTML.
 * Uplink dot + status text, Ctrl+K hint, session ID.
 */
export function SessionStatus() {
  const t = useTranslations("chat");
  const conversationId = useChatStore((s) => s.conversationId);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Defer mount state to next tick to avoid hydration issues
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const sessionLabel =
    isMounted && conversationId
      ? `SESSION_${conversationId.split("-")[0].toUpperCase()}`
      : "SESSION_CLEO";

  return (
    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
      <div className="flex items-center gap-3">
        <div className="size-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-pulse" />
        <span className="text-[10px] font-medium text-white/60 tracking-[0.2em] uppercase">
          {t("sessionStable")}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[9px] text-white/30 font-mono tracking-widest uppercase hidden md:inline">
          {sessionLabel}
        </span>
      </div>
    </div>
  );
}
