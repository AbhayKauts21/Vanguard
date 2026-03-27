"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/domains/chat/model";

/**
 * Status bar at top of chat panel — matches original HTML.
 * Uplink dot + status text, Ctrl+K hint, session ID.
 */
export function SessionStatus({ onNewChat }: { onNewChat?: () => void }) {
  const t = useTranslations("chat");
  const headerT = useTranslations("header");
  const mode = useChatStore((s) => s.mode);
  const conversationId = useChatStore((s) => s.conversationId);
  const newConversation = useChatStore((s) => s.newConversation);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
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

  const handlePrimaryAction = mode === "user" ? onNewChat ?? (() => {}) : newConversation;
  const primaryLabel = mode === "user" ? headerT("newChat") : headerT("newSession");

  return (
    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
      <div className="flex items-center gap-3">
        <div className="size-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-pulse" />
        <span className="text-[10px] font-medium text-white/60 tracking-[0.2em] uppercase">
          {t("sessionStable")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-white/30 font-mono tracking-widest uppercase hidden md:inline">
          {sessionLabel}
        </span>
        <ActionButton
          icon="add"
          label={primaryLabel}
          onClick={handlePrimaryAction}
        />
        {mode === "guest" ? (
          <ActionButton
            icon="ink_eraser"
            label={headerT("clearThread")}
            onClick={clearMessages}
            disabled={!hasMessages}
          />
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative overflow-hidden rounded-[0.9rem] border border-white/10 bg-black/45 px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/58 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
      <span className="relative flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] font-light">{icon}</span>
        <span>{label}</span>
      </span>
    </button>
  );
}
