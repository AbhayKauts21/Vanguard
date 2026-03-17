"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

/* Empty state shown when no messages exist. */
export function EmptyState() {
  const t = useTranslations("chat");
  const tc = useTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      {/* Ambient glow ring */}
      <div className="relative">
        <div className="animate-breathe h-20 w-20 rounded-full border border-[var(--cleo-cyan)]/20 bg-[var(--cleo-cyan)]/5" />
        <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-[var(--cleo-cyan)]/60" />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-medium text-[var(--cleo-text-primary)]">
          {t("emptyState")}
        </h2>
        <p className="mt-1 text-sm text-[var(--cleo-text-muted)]">{t("emptyStateHint")}</p>
      </div>
    </div>
  );
}
