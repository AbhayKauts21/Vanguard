"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

/**
 * Header bar — exact match to original HTML.
 * Grain icon, CLEO shimmer logo, nav links, settings + power buttons.
 */
export function TopBar() {
  const t = useTranslations("header");

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-10 py-5 glass-panel z-50">
      {/* Brand: grain icon + CLEO shimmer */}
      <div className="flex items-center gap-6 group cursor-pointer">
        <div className="size-6 transition-transform duration-700 group-hover:rotate-[180deg]">
          <span className="material-symbols-outlined text-2xl font-light">grain</span>
        </div>
        <h2 className="text-xl font-light cleo-logo uppercase">CLEO</h2>
      </div>

      {/* Right side: nav + actions */}
      <div className="flex flex-1 justify-end gap-10">
        {/* Nav links */}
        <div className="flex items-center gap-10">
          {(["neuralLink", "archive", "nexus"] as const).map((key) => (
            <a
              key={key}
              href="#"
              className="text-white/40 hover:text-white transition-all text-[10px] font-medium tracking-[0.15em] uppercase"
            >
              {t(key)}
            </a>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 items-center">
          <LanguageSwitcher />
          <button className="flex items-center justify-center rounded-full h-9 w-9 bg-white/5 text-white/70 border border-white/10 transition-all hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button className="flex items-center justify-center rounded-full h-9 w-9 bg-white/5 text-white/40 border border-white/10 transition-all hover:bg-white/10">
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </div>
      </div>
    </header>
  );
}
