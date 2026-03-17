"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/* Bottom status bar — system health and version info. */
export function FooterStatusBar() {
  const t = useTranslations("footer");

  return (
    <footer
      className={cn(
        "relative z-[var(--z-header)] flex h-8 items-center justify-between",
        "border-t border-[var(--cleo-border)] px-6",
        "bg-[var(--cleo-bg-panel)] backdrop-blur-[var(--cleo-glass-blur)]",
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-[var(--cleo-text-muted)]">
        {t("poweredBy")}
      </span>
      <span className="text-[10px] text-[var(--cleo-text-muted)]">{t("version")}</span>
    </footer>
  );
}
