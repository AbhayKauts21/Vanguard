"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Citation } from "@/types";
import { fireNeuralLink } from "@/components/effects/NeuralSvgOverlay";

interface CitationListProps {
  primary?: Citation[];
  secondary?: Citation[];
  all?: Citation[];
  hiddenCount?: number;
}

export function CitationList({ primary = [], secondary = [], all = [], hiddenCount = 0 }: CitationListProps) {
  const t = useTranslations("chat");
  const [isOpen, setIsOpen] = useState(false);

  if (primary.length === 0 && secondary.length === 0 && all.length === 0) return null;

  const primaryIds = new Set(primary.map((citation) => citation.page_id));
  const secondaryIds = new Set(secondary.map((citation) => citation.page_id));
  const tertiary = all.filter(
    (citation) => !primaryIds.has(citation.page_id) && !secondaryIds.has(citation.page_id),
  );
  const totalSources = primary.length + secondary.length + tertiary.length;
  const featuredSource = primary[0] ?? secondary[0] ?? tertiary[0];

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-white/20 hover:bg-white/[0.06]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/15 bg-emerald-400/10 text-emerald-300">
            <span className="material-symbols-outlined text-[16px]">library_books</span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {t("sourcesSummary", { count: totalSources })}
            </p>
            {featuredSource && (
              <p className="truncate text-[12px] text-white/85">
                {featuredSource.page_title}
              </p>
            )}
          </div>
        </div>
        <span className={`material-symbols-outlined text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-75"}`}>
        <div className="overflow-hidden">
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {t("sourcesDrawerTitle")}
                </p>
                <p className="text-[12px] text-white/75">
                  {t("sourcesSummary", { count: totalSources })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
              >
                {t("collapseSources")}
              </button>
            </div>

            {primary.length > 0 && (
              <SourceSection title="Primary" citations={primary} tier="primary" />
            )}

            {secondary.length > 0 && (
              <SourceSection title="Secondary" citations={secondary} tier="secondary" />
            )}

            {tertiary.length > 0 && (
              <SourceSection title="Context" citations={tertiary} tier="tertiary" />
            )}
          </div>
        </div>
      </div>

      {hiddenCount > 0 && !isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-2 flex items-center gap-1.5 self-start text-[11px] font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          <span className="material-symbols-outlined text-[14px]">expand_more</span>
          {t("expandSources", { count: hiddenCount })}
        </button>
      )}
    </div>
  );
}

function SourceSection({
  title,
  citations,
  tier,
}: {
  title: string;
  citations: Citation[];
  tier: "primary" | "secondary" | "tertiary";
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
        {title}
      </p>
      <div className="flex flex-col gap-2.5">
        {citations.map((citation) => (
          <SourceCard key={`${tier}-${citation.page_id}`} citation={citation} tier={tier} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ citation, tier }: { citation: Citation; tier: "primary" | "secondary" | "tertiary" }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("chat");

  function handleClick() {
    if (ref.current) fireNeuralLink(ref.current);
    if (citation.source_url) {
      window.open(citation.source_url, "_blank", "noopener,noreferrer");
    }
  }

  const baseStyles = "source-card flex items-center justify-between rounded-xl border p-3.5 transition-all cursor-pointer group";
  const tierStyles = {
    primary: "bg-white/[0.04] border-white/20 hover:bg-white/10 hover:border-emerald-500/40",
    secondary: "bg-white/[0.02] border-white/10 hover:bg-white/[0.06] hover:border-white/20 opacity-90",
    tertiary: "bg-transparent border-white/5 hover:bg-white/[0.03] opacity-70",
  };

  return (
    <div ref={ref} onClick={handleClick} className={`${baseStyles} ${tierStyles[tier]}`}>
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-white/40 group-hover:text-white/80 transition-colors text-lg">
          {citation.source_type === "vector" ? "memory" : "database"}
        </span>
        <div>
          <p className="text-[11px] font-semibold text-white/90 leading-tight">
            {citation.page_title}
          </p>
          <p className="text-[9px] text-white/40 tracking-wider mt-0.5">
            {citation.source_name || `Page ${citation.page_id}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${tier === 'primary' ? 'bg-emerald-400/80' : 'bg-emerald-400/40'}`}
            style={{ width: `${Math.round(citation.score * 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35 transition-colors group-hover:text-white/60">
          {t("viewOriginal")}
        </span>
      </div>
    </div>
  );
}
