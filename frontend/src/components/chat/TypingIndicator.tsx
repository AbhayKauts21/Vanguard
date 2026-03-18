"use client";

import { useTranslations } from "next-intl";

/* Typing indicator with waveform bars — matches original CLEO style. */
export function TypingIndicator() {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-3 px-8 py-2 message-bloom">
      <div className="size-6 rounded-full glass-panel flex items-center justify-center border border-white/20 bg-white/5">
        <div className="flex items-end h-3 gap-[1px]">
          <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.1s" }} />
          <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.3s" }} />
          <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.2s" }} />
        </div>
      </div>
      <span className="text-[10px] text-white/40 uppercase tracking-widest">{t("thinking")}</span>
    </div>
  );
}
