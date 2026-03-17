"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Citation } from "@/types";
import { ExternalLink } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

/* Single chat message bubble — user or assistant. */
export function MessageBubble({ role, content, citations, isStreaming }: MessageBubbleProps) {
  const t = useTranslations("chat");
  const isUser = role === "user";

  return (
    <div className={cn("animate-fade-in-up flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-[var(--cleo-radius-md)] px-4 py-3",
          isUser
            ? "bg-[var(--cleo-cyan)]/10 border border-[var(--cleo-cyan)]/20 text-[var(--cleo-text-primary)]"
            : "bg-[var(--cleo-bg-glass)] border border-[var(--cleo-border)] text-[var(--cleo-text-primary)]",
        )}
      >
        {/* Message text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="animate-blink ml-0.5 inline-block h-4 w-[2px] bg-[var(--cleo-cyan)]" />
        )}

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--cleo-border)] pt-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--cleo-text-muted)]">
              {t("citations")}
            </span>
            {citations.map((c) => (
              <CitationCard key={c.page_id} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Compact citation link card. */
function CitationCard({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.page_url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-[var(--cleo-radius-sm)] px-2.5 py-1.5",
        "border border-[var(--cleo-border)] bg-[var(--cleo-bg-glass)]",
        "text-xs text-[var(--cleo-text-secondary)] transition-colors",
        "hover:border-[var(--cleo-border-hover)] hover:text-[var(--cleo-text-primary)]",
      )}
    >
      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--cleo-cyan)]" />
      <span className="truncate">{citation.page_title}</span>
    </a>
  );
}
