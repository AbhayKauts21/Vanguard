"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { ChatSummary } from "@/types";

interface ChatHistoryRailProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  isLoading?: boolean;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onToggleCollapse: () => void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function ChatHistoryRail({
  chats,
  activeChatId,
  isLoading = false,
  onSelectChat,
  onCreateChat,
  onToggleCollapse,
}: ChatHistoryRailProps) {
  const t = useTranslations("chat");
  const headerT = useTranslations("header");

  const renderedChats = useMemo(
    () =>
      chats.map((chat) => ({
        ...chat,
        title: chat.title?.trim() || t("untitledChat"),
        timestamp: formatTimestamp(chat.updated_at),
      })),
    [chats, t],
  );

  return (
    <aside className="w-full shrink-0 border-b border-white/10 bg-black/30 lg:w-72 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            {t("historyTitle")}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {t("historySubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateChat}
            className="inline-flex items-center gap-2 rounded-[0.9rem] border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[14px] font-light">
              add
            </span>
            <span>{headerT("newChat")}</span>
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t("historyCollapse")}
            title={t("historyCollapse")}
            className="inline-flex size-9 items-center justify-center rounded-[0.9rem] border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] font-light">
              left_panel_close
            </span>
          </button>
        </div>
      </div>

      <div className="max-h-[13rem] overflow-y-auto p-3 lg:max-h-none lg:h-[calc(100%-4.5rem)] lg:pb-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`chat-skeleton-${index}`}
                className="h-16 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]"
              />
            ))}
          </div>
        ) : renderedChats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/45">
            {t("historyEmpty")}
          </div>
        ) : (
          <div className="space-y-2">
            {renderedChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={[
                    "block w-full rounded-2xl border px-4 py-3 text-left transition-all",
                    isActive
                      ? "border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.08)]"
                      : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-white/90">
                      {chat.title}
                    </p>
                    <span
                      className={[
                        "mt-1 size-2 shrink-0 rounded-full",
                        isActive ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]" : "bg-white/15",
                      ].join(" ")}
                    />
                  </div>

                  {chat.last_message_preview ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">
                      {chat.last_message_preview}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-white/35">
                      {t("historyNoMessages")}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-white/30">
                    <span>{chat.timestamp}</span>
                    <span>{t("historyMessageCount", { count: chat.message_count })}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
