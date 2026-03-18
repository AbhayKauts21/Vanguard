"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

/* Toggle between supported locales — styled to match header buttons. */
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
      className="flex items-center gap-1.5 rounded-full h-9 px-3 bg-white/5 text-white/70 border border-white/10 transition-all hover:bg-white/10 text-[10px] font-medium tracking-widest uppercase"
    >
      <span className="material-symbols-outlined text-[14px]">language</span>
      {label}
    </button>
  );
}
