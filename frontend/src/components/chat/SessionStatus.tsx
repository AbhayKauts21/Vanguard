"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui";

/* Session status strip shown above the chat message list. */
export function SessionStatus() {
  const t = useTranslations("chat");

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2",
        "border-b border-[var(--cleo-border)]",
      )}
    >
      <StatusBadge status="online" label={t("sessionStable")} />
      <span className="text-[10px] uppercase tracking-wider text-[var(--cleo-text-muted)]">
        CLEO v0.1
      </span>
    </div>
  );
}
