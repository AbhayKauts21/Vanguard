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
  const newConversation = useChatStore((s) => s.newConversation);
  const conversationId = useChatStore((s) => s.conversationId);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
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
        <button
          onClick={newConversation}
          title="Start a new conversation"
          className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded transition-colors border border-white/5 text-[10px] font-medium tracking-wide uppercase group cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">add_circle</span>
          <span className="group-hover:opacity-100 opacity-80">New Chat</span>
        </button>
        <span className="text-[9px] text-white/30 font-mono tracking-widest uppercase hidden lg:inline">
          Ctrl+K: Terminal
        </span>
        <span className="text-[9px] text-white/30 font-mono tracking-widest hidden md:inline">
          {sessionLabel}
        </span>
      </div>
    </div>
  );
}
