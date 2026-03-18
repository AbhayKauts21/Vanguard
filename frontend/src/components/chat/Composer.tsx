"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

/**
 * Chat input composer — matches original HTML exactly.
 * Rounded-full input with gradient glow aura, arrow_upward send button.
 */
export function Composer({ onSend, disabled = false }: ComposerProps) {
  const t = useTranslations("chat");
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="p-8">
      <form onSubmit={handleSubmit} className="relative group" id="input-container">
        {/* Gradient glow aura */}
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/10 via-white/10 to-violet-500/10 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition duration-700 animate-pulse-slow" />

        {/* Input wrapper */}
        <div className="relative flex items-center bg-black border border-white/10 rounded-full px-7 py-4 liquid-glow">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            disabled={disabled}
            className="glow-scribe bg-transparent border-none focus:ring-0 focus:outline-none text-white text-[13px] flex-1 placeholder-white/20 font-light"
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="ml-2 text-white/30 hover:text-white hover:scale-110 active:scale-95 transition-all duration-500 disabled:opacity-30"
          >
            <span className="material-symbols-outlined font-light">arrow_upward</span>
          </button>
        </div>
      </form>
    </div>
  );
}
