"use client";

import { useTranslations } from "next-intl";

interface SuggestedPromptRailProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SuggestedPromptRail({
  onSend,
  disabled = false,
  className = "",
}: SuggestedPromptRailProps) {
  const t = useTranslations("chat");
  const promptChips = [
    t("promptWhatIsCleo"),
    t("promptWhatCanCleoDo"),
    t("promptHowToUseCleo"),
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
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
  );
}
