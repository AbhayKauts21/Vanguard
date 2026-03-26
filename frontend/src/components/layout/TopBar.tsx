"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { spawnShockwave } from "@/components/effects";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useChatStore } from "@/domains/chat/model";
import { AuthStatusMenu } from "@/domains/auth/components";
import { Link } from "@/i18n/navigation";

/**
 * Header bar — exact match to original HTML.
 * Grain icon, CLEO shimmer logo, nav links, settings + power buttons.
 */
export function TopBar() {
  const t = useTranslations("header");
  const newConversation = useChatStore((s) => s.newConversation);
  const clearMessages = useChatStore((s) => s.clearMessages);

  function handleShockwave(event: MouseEvent<HTMLButtonElement>) {
    spawnShockwave(event.clientX, event.clientY);
  }

  function focusInput() {
    const input = document.getElementById("cleo-input") as HTMLInputElement | null;
    input?.focus();
  }

  const actionButtonClass =
    "rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/55 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white";

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-10 py-5 glass-panel" style={{ zIndex: 150 }}>
      {/* Brand: grain icon + CLEO shimmer */}
      <div className="flex items-center gap-6 group cursor-pointer">
        <div className="size-6 transition-transform duration-700 group-hover:rotate-[180deg]">
          <span className="material-symbols-outlined text-2xl font-light">grain</span>
        </div>
        <h2 className="text-xl font-light cleo-logo uppercase relative" style={{ zIndex: 160 }}>CLEO</h2>
      </div>

      <div className="flex flex-1 justify-end gap-10">
        <div className="flex items-center gap-10">
          <button type="button" onClick={newConversation} className={actionButtonClass}>
            {t("newSession")}
          </button>
          <button type="button" onClick={clearMessages} className={actionButtonClass}>
            {t("clearThread")}
          </button>
          <button type="button" onClick={focusInput} className={actionButtonClass}>
            {t("focusInput")}
          </button>
          <Link href="/admin" className={actionButtonClass}>
            {t("adminConsole")}
          </Link>
        </div>

        <div className="flex gap-4 items-center">
          <LanguageSwitcher />
          <AuthStatusMenu />
          <button
            className="flex items-center justify-center rounded-full h-9 w-9 bg-white/5 text-white/70 border border-white/10 transition-all hover:bg-white/10"
            onClick={handleShockwave}
            title={t("pulseInterface")}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button
            className="flex items-center justify-center rounded-full h-9 w-9 bg-white/5 text-white/70 border border-white/10 transition-all hover:bg-white/10"
            onClick={focusInput}
            title={t("focusInput")}
          >
            <span className="material-symbols-outlined text-[18px]">north_east</span>
          </button>
        </div>
      </div>
    </header>
  );
}
