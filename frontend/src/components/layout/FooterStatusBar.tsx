"use client";

import { useTranslations } from "next-intl";

/**
 * Footer bar — exact match to original HTML.
 * Neural Mesh Analysis + location node + build string.
 */
export function FooterStatusBar() {
  const t = useTranslations("footer");

  return (
    <footer className="px-10 py-4 flex justify-between border-t border-white/5 glass-panel z-50">
      <div className="flex gap-8 items-center">
        <div className="flex items-center gap-2.5 group cursor-pointer">
          <span className="material-symbols-outlined text-[14px] text-white/20 group-hover:text-white/50 transition-colors font-light">
            hub
          </span>
          <span className="text-[9px] uppercase font-medium tracking-[0.25em] text-white/20 group-hover:text-white/50 transition-colors">
            {t("neuralMesh")}
          </span>
        </div>
      </div>

      <div className="text-[9px] font-medium text-white/10 uppercase tracking-[0.3em]">
        {t("buildInfo")}
      </div>
    </footer>
  );
}
