"use client";

import { useTranslations } from "next-intl";

/**
 * Footer bar — intentionally minimal so the interface ends on a clean edge.
 */
export function FooterStatusBar() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-white/5 bg-black/92 px-10 py-4 text-right">
      <div className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/14">
        {t("buildInfo")}
      </div>
    </footer>
  );
}
