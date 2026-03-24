"use client";

import { useTranslations } from "next-intl";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { useAvatarState } from "@/domains/avatar/hooks/useAvatarState";

/**
 * AvatarControls — mute/unmute audio and connection status indicator.
 *
 * Renders as a floating control bar overlaid on the avatar video.
 * Muting stops avatar audio output while keeping the video stream alive.
 */
export function AvatarControls() {
  const t = useTranslations("avatar");
  const { isMuted, toggleMute, isConnected } = useAvatarStore();
  const { state, isSpeaking, isListening } = useAvatarState();

  if (!isConnected) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-2 backdrop-blur-md">
      {/* Connection status dot */}
      <span
        className={`h-2 w-2 rounded-full ${
          isSpeaking
            ? "bg-green-400 animate-pulse"
            : isListening
              ? "bg-amber-400 animate-pulse"
              : "bg-emerald-400"
        }`}
        title={t(`state_${state}` as never)}
      />

      {/* State label */}
      <span className="text-[10px] uppercase tracking-widest text-white/60">
        {isSpeaking
          ? t("speaking")
          : isListening
            ? t("listening")
            : t("idle")}
      </span>

      {/* Mute / Unmute button */}
      <button
        onClick={toggleMute}
        className="ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={isMuted ? t("unmute") : t("mute")}
        title={isMuted ? t("unmute") : t("mute")}
      >
        {isMuted ? (
          /* Volume off icon */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          /* Volume on icon */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>
    </div>
  );
}
