"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Brain } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

/* Top navigation bar with CLEO branding and nav links. */
export function TopBar() {
  const t = useTranslations("header");
  const tc = useTranslations("common");

  return (
    <header
      className={cn(
        "relative z-[var(--z-header)] flex h-14 items-center justify-between",
        "border-b border-[var(--cleo-border)] px-6",
        "bg-[var(--cleo-bg-panel)] backdrop-blur-[var(--cleo-glass-blur)]",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-[var(--cleo-cyan)]" />
        <span className="text-sm font-bold tracking-widest text-[var(--cleo-text-primary)]">
          {tc("appName")}
        </span>
      </div>

      {/* Nav links */}
      <nav className="hidden items-center gap-6 md:flex">
        {(["neuralLink", "archive", "nexus"] as const).map((key) => (
          <span
            key={key}
            className="cursor-pointer text-xs uppercase tracking-wider text-[var(--cleo-text-muted)] transition-colors hover:text-[var(--cleo-text-secondary)]"
          >
            {t(key)}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
