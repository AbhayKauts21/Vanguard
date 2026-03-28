"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmationModal } from "@/components/ui";

import type { ChatSummary } from "@/types";

interface ChatHistoryRailProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  isLoading?: boolean;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
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
  onDeleteChat,
  onToggleCollapse,
}: ChatHistoryRailProps) {
  const t = useTranslations("chat");
  const headerT = useTranslations("header");

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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
                    "block group w-full rounded-2xl border px-4 py-3 text-left transition-all",
                    isActive
                      ? "border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.08)]"
                      : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-white/90">
                      {chat.title}
                    </p>
                    <div className="flex items-start gap-2">
                      <span
                        className={[
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          isActive ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]" : "bg-white/15",
                        ].join(" ")}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(chat.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 hover:text-red-400"
                        title="Delete chat"
                      >
                        <span className="material-symbols-outlined text-[16px] font-light">delete</span>
                      </button>
                    </div>
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

      <ConfirmationModal
        isOpen={!!deleteTargetId}
        title="Delete Conversation"
        message="Are you sure you want to delete this chat history? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        isDestructive
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteChat(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </aside>
  );
}
