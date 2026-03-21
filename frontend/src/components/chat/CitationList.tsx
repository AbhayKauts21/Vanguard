"use client";

import { useState, useRef } from "react";
import type { Citation } from "@/types";
import { fireNeuralLink } from "@/components/effects/NeuralSvgOverlay";

interface CitationListProps {
  primary?: Citation[];
  secondary?: Citation[];
  all?: Citation[];
  hiddenCount?: number;
}

export function CitationList({ primary = [], secondary = [], all = [], hiddenCount = 0 }: CitationListProps) {
  const [showAll, setShowAll] = useState(false);

  if (primary.length === 0 && secondary.length === 0) return null;

  // Tertiary sources are those not in primary or secondary
  const primaryIds = new Set(primary.map(c => c.page_id));
  const secondaryIds = new Set(secondary.map(c => c.page_id));
  const tertiary = all.filter(c => !primaryIds.has(c.page_id) && !secondaryIds.has(c.page_id));

  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {/* Primary Citations */}
      {primary.map((c) => (
        <SourceCard key={`p-${c.page_id}`} citation={c} tier="primary" />
      ))}
      
      {/* Secondary Citations */}
      {secondary.map((c) => (
        <SourceCard key={`s-${c.page_id}`} citation={c} tier="secondary" />
      ))}

      {/* Tertiary Citations (Rendered when expanded) */}
      {showAll && tertiary.map((c) => (
        <SourceCard key={`t-${c.page_id}`} citation={c} tier="tertiary" />
      ))}

      {/* Tertiary / Hidden Expand Button */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors self-start mt-1 flex items-center gap-1.5 font-medium"
        >
          <span className="material-symbols-outlined text-[14px]">expand_more</span>
          View {hiddenCount} more {hiddenCount === 1 ? 'source' : 'sources'}
        </button>
      )}
      
      {showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors self-start mt-1 flex items-center gap-1.5 font-medium"
        >
          <span className="material-symbols-outlined text-[14px]">expand_less</span>
          Hide sources
        </button>
      )}
    </div>
  );
}

function SourceCard({ citation, tier }: { citation: Citation; tier: "primary" | "secondary" | "tertiary" }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick() {
    if (ref.current) fireNeuralLink(ref.current);
    if (citation.source_url) {
      window.open(citation.source_url, "_blank", "noopener,noreferrer");
    }
  }

  const baseStyles = "source-card flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group";
  const tierStyles = {
    primary: "bg-white/[0.04] border-white/20 hover:bg-white/10 hover:border-emerald-500/40",
    secondary: "bg-white/[0.02] border-white/10 hover:bg-white/[0.06] hover:border-white/20 opacity-90",
    tertiary: "bg-transparent border-white/5 hover:bg-white/[0.03] opacity-70"
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
        <span className="material-symbols-outlined text-sm text-white/30 group-hover:translate-x-0.5 transition-transform">
          chevron_right
        </span>
      </div>
    </div>
  );
}
