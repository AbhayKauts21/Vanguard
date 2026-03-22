"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { env } from "@/lib/env";

interface ComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

/**
 * Chat input composer — matches original HTML exactly.
 * Rounded-full input with gradient glow aura, avatar voice toggle, arrow_upward send button.
 */
export function Composer({ onSend, disabled = false }: ComposerProps) {
  const t = useTranslations("chat");
  const tAvatar = useTranslations("avatar");
  const [value, setValue] = useState("");

  /* Avatar mute state from the global Zustand store — actually functional. */
  const isMuted = useAvatarStore((s) => s.isMuted);
  const isConnected = useAvatarStore((s) => s.isConnected);
  const toggleMute = useAvatarStore((s) => s.toggleMute);

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

  /* Only render the toggle when the avatar feature is enabled. */
  const showAvatarToggle = env.enableAvatar;

  return (
    <div className="p-8">
      <form onSubmit={handleSubmit} className="relative group" id="input-container">
        {/* Gradient glow aura */}
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/10 via-white/10 to-violet-500/10 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition duration-700 animate-pulse-slow" />

        {/* Input wrapper — everything lives inside the pill */}
        <div className="relative flex items-center bg-black border border-white/10 rounded-full px-7 py-4 liquid-glow gap-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            disabled={disabled}
            className="glow-scribe bg-transparent border-none focus:ring-0 focus:outline-none text-white text-[13px] flex-1 placeholder-white/20 font-light"
          />

          {/* Avatar voice toggle — inside the pill, left of send */}
          {showAvatarToggle && (
            <button
              type="button"
              onClick={toggleMute}
              className={`relative flex items-center justify-center h-8 w-8 rounded-full transition-all duration-500 ${
                !isMuted && isConnected
                  ? "text-white/90 bg-white/10 hover:bg-white/15 shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                  : "text-white/25 hover:text-white/50 hover:bg-white/5"
              }`}
              title={isMuted ? tAvatar("unmute") : tAvatar("mute")}
            >
              <span className="material-symbols-outlined text-[18px] font-light">
                {isMuted ? "voice_over_off" : "record_voice_over"}
              </span>
              {/* Subtle live dot when avatar is connected and unmuted */}
              {!isMuted && isConnected && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />
              )}
            </button>
          )}

          {/* Send */}
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="text-white/30 hover:text-white hover:scale-110 active:scale-95 transition-all duration-500 disabled:opacity-30"
          >
            <span className="material-symbols-outlined font-light">arrow_upward</span>
          </button>
        </div>
      </form>
    </div>
  );
}
