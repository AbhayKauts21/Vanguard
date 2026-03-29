"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { spawnShockwave } from "@/components/effects";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { AuthStatusMenu } from "@/domains/auth/components";
import { Link } from "@/i18n/navigation";

/**
 * Header bar — exact match to original HTML.
 * Grain icon, CLEO shimmer logo, nav links, settings + power buttons.
 */
export function TopBar() {
  const t = useTranslations("header");

  function handleShockwave(event: MouseEvent<HTMLButtonElement>) {
    spawnShockwave(event.clientX, event.clientY);
  }

  function focusInput() {
    const input = document.getElementById("cleo-input") as HTMLInputElement | null;
    input?.focus();
  }

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-10 py-5 glass-panel" style={{ zIndex: 150 }}>
      <div className="flex items-center gap-6 group cursor-pointer">
        <div className="size-6 transition-transform duration-700 group-hover:rotate-[180deg]">
          <span aria-hidden="true" className="material-symbols-outlined text-2xl font-light">grain</span>
        </div>
        <h2 className="text-xl font-light cleo-logo uppercase relative" style={{ zIndex: 160 }}>CLEO</h2>
      </div>

      <div className="flex flex-1 justify-end gap-6">
        <div className="flex items-center gap-3">
          <HeaderAction
            icon="center_focus_strong"
            label={t("focusInput")}
            subtitle={t("focusInputHint")}
            onClick={focusInput}
          />
          <HeaderAction
            icon="deployed_code"
            label={t("adminConsole")}
            subtitle={t("adminConsoleHint")}
            href="/admin"
          />
          <HeaderAction
            icon="upload_file"
            label={t("documentsLibrary")}
            subtitle={t("documentsLibraryHint")}
            href="/documents"
          />
        </div>

        <div className="flex gap-4 items-center">
          <LanguageSwitcher />
          <AuthStatusMenu />
          <button
            className="flex items-center justify-center rounded-full h-9 w-9 bg-white/5 text-white/70 border border-white/10 transition-all hover:bg-white/10"
            onClick={handleShockwave}
            title={t("pulseInterface")}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button
            className="flex items-center justify-center rounded-full h-9 w-9 bg-white/5 text-white/70 border border-white/10 transition-all hover:bg-white/10"
            onClick={focusInput}
            title={t("focusInput")}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">north_east</span>
          </button>
        </div>
      </div>
    </header>
  );
}

interface HeaderActionProps {
  icon: string;
  label: string;
  subtitle: string;
  href?: string;
  onClick?: () => void;
}

function HeaderAction({ icon, label, subtitle, href, onClick }: HeaderActionProps) {
  const className =
    "group relative isolate flex min-w-[11.5rem] items-center gap-3 overflow-hidden rounded-[1.15rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] px-4 py-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))]";

  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border border-white/12 bg-white/[0.03] transition-colors duration-300 group-hover:bg-white/[0.12]" />
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-black/55 text-white/70 transition-colors duration-300 group-hover:border-white/20 group-hover:text-white">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] font-light">{icon}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">
          {label}
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/28">
          {subtitle}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
