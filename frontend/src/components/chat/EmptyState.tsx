"use client";

import { useTranslations } from "next-intl";

interface EmptyStateProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

/* Empty state — initial CLEO prompt plus quick-start actions. */
export function EmptyState({ onSend, disabled = false }: EmptyStateProps) {
  const t = useTranslations("chat");
  const promptChips = [
    t("promptArchitecture"),
    t("promptCapabilities"),
    t("promptKnowledgeBase"),
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
      <div className="flex max-w-[95%] flex-col gap-3 message-bloom">
        <div className="mb-0.5 flex items-center gap-3">
          <div className="size-6 rounded-full glass-panel flex items-center justify-center border border-white/20 bg-white/5">
            <div className="flex items-end h-3 gap-[1px]">
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.1s" }} />
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.3s" }} />
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            CLEO Core
          </span>
        </div>
        <div className="inline-block w-fit rounded-2xl rounded-tl-none border border-white/10 bg-white/[0.03] p-5 text-[13px] leading-relaxed text-white/80 shadow-sm transition-colors hover:border-white/20">
          {t("initialMessage")}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {promptChips.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={disabled}
              onClick={() => onSend(prompt)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-medium tracking-[0.08em] text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
