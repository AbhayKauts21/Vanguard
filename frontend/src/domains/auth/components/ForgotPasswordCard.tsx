"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { Link } from "@/i18n/navigation";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45 outline-none placeholder:text-white/20";

export function ForgotPasswordCard() {
  const t = useTranslations("auth");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-white/45" htmlFor="forgotEmail">
          {t("email")}
        </label>
        <input
          id="forgotEmail"
          className={inputClassName}
          type="email"
          placeholder={t("emailPlaceholder")}
          disabled
          aria-disabled="true"
        />
      </div>

      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-4 text-sm leading-6 text-amber-100">
        <p className="font-medium">{t("forgotUnsupportedTitle")}</p>
        <p className="mt-2 text-amber-100/75">{t("forgotUnsupportedBody")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild size="lg">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
        <span className="text-sm text-white/45">{t("forgotUnsupportedHint")}</span>
      </div>
    </div>
  );
}
