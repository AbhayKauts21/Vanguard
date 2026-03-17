"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

/* Toggle between supported locales. */
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const nextLocale = locale === "en" ? "es" : "en";
  const label = locale === "en" ? "ES" : "EN";

  function switchLocale() {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <button
      onClick={switchLocale}
      aria-label={`Switch to ${nextLocale}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1",
        "border border-[var(--cleo-border)] bg-[var(--cleo-bg-glass)]",
        "text-[10px] font-medium uppercase tracking-wider text-[var(--cleo-text-secondary)]",
        "transition-colors hover:border-[var(--cleo-border-hover)] hover:text-[var(--cleo-text-primary)]",
      )}
    >
      <Globe className="h-3 w-3" />
      {label}
    </button>
  );
}
