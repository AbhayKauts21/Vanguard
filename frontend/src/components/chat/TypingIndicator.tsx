"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/* Animated typing indicator for assistant processing state. */
export function TypingIndicator() {
  const t = useTranslations("chat");

  return (
    <div className="animate-fade-in-up flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[var(--cleo-cyan)]/60"
            style={{ animation: `glow-pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <span className="text-xs text-[var(--cleo-text-muted)]">{t("thinking")}</span>
    </div>
  );
}
