"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { authApi } from "@/domains/auth/api";
import { useAuthStore } from "@/domains/auth/model";

function getPrimaryRoleLabel(roleName?: string | null): string {
  if (!roleName) return "viewer";
  return roleName;
}

export function AuthStatusMenu() {
  const t = useTranslations("account");
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const primaryRole = getPrimaryRoleLabel(user?.roles?.[0]?.name);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Clear local state even if revoke fails so the UI doesn't hold a bad session.
    } finally {
      clearSession();
      setIsOpen(false);
      setIsLoggingOut(false);
      router.push("/login");
    }
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t("login")}</Link>
        </Button>
        <Button asChild variant="glass" size="sm">
          <Link href="/register">{t("register")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={t("openMenu")}
          className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-white/80 transition-all hover:bg-white/10"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-[11px] font-medium uppercase tracking-[0.18em] text-white">
            {(user.full_name?.[0] ?? user.email[0] ?? "C").toUpperCase()}
          </div>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-[11px] uppercase tracking-[0.24em] text-white/38">
              {t("signedIn")}
            </div>
            <div className="truncate text-sm text-white">{user.full_name ?? user.email}</div>
          </div>
          <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100/85">
            {primaryRole}
          </span>
          <span className="material-symbols-outlined text-[18px] text-white/45 transition group-data-[state=open]:rotate-180">
            expand_more
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={12}
          className="z-[220] min-w-[280px] rounded-3xl border border-white/10 bg-black/85 p-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          <div className="rounded-[1.25rem] border border-white/7 bg-white/[0.03] px-4 py-4">
            <p className="mb-1 text-[10px] uppercase tracking-[0.24em] text-white/35">
              {t("signedIn")}
            </p>
            <p className="truncate text-sm font-medium text-white">
              {user.full_name ?? t("unnamedUser")}
            </p>
            <p className="truncate text-xs text-white/50">{user.email}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/7 bg-white/[0.02] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  {t("role")}
                </p>
                <p className="mt-2 text-sm text-white">{primaryRole}</p>
              </div>
              <div className="rounded-2xl border border-white/7 bg-white/[0.02] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  {t("permissions")}
                </p>
                <p className="mt-2 text-sm text-white">{user.permissions.length}</p>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            <DropdownMenu.Item asChild>
              <Link
                href="/"
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-white/75 outline-none transition hover:bg-white/6 hover:text-white"
              >
                <span>{t("goToChat")}</span>
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_outward</span>
              </Link>
            </DropdownMenu.Item>

            <DropdownMenu.Item asChild>
              <Link
                href="/admin"
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-white/75 outline-none transition hover:bg-white/6 hover:text-white"
              >
                <span>{t("goToSystem")}</span>
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">tune</span>
              </Link>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-white/8" />

            <DropdownMenu.Item asChild>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-rose-100/85 outline-none transition hover:bg-rose-500/10 disabled:opacity-50"
              >
                <span>{isLoggingOut ? t("loggingOut") : t("logout")}</span>
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
