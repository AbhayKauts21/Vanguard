"use client";

import { useVoiceStore } from "@/domains/voice/model";

interface VoiceModeButtonProps {
  /** Called when the user clicks the mic to start listening. */
  onActivate: () => void;
  /** Called when the user clicks stop to send the voice message. */
  onSend: () => void;
  /** Whether the button should be disabled (e.g. during text chat). */
  disabled?: boolean;
}

/**
 * Voice mode mic button — integrated into the Composer.
 *
 * States:
 * - Idle: shows mic icon, click to activate
 * - Listening: pulsing ring, shows stop icon, click to send
 * - Processing: spinning indicator, non-interactive
 * - Speaking: passive speaking indicator; interruption is voice-only
 */
export function VoiceModeButton({
  onActivate,
  onSend,
  disabled = false,
}: VoiceModeButtonProps) {
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const phase = useVoiceStore((s) => s.phase);
  const isSupported = useVoiceStore((s) => s.isSupported);

  if (!isSupported) return null;

  const isListening = isVoiceMode && phase === "listening";
  const isProcessing = isVoiceMode && phase === "processing";
  const isSpeaking = isVoiceMode && phase === "speaking";
  const isIdle = !isVoiceMode || phase === "idle";

  function handleClick() {
    if (disabled) return;

    if (isIdle && !isVoiceMode) {
      onActivate();
    } else if (isListening) {
      onSend();
    }
  }

  // Icon and color per phase
  let icon = "mic";
  let colorClasses = "text-white/30 hover:text-white";
  let pulseRing = false;
  let ariaLabel = "Start voice mode";

  if (isListening) {
    icon = "stop_circle";
    colorClasses = "text-purple-400 hover:text-purple-300";
    pulseRing = true;
    ariaLabel = "Stop listening and send";
  } else if (isProcessing) {
    icon = "pending";
    colorClasses = "text-amber-400 animate-spin";
    ariaLabel = "Processing voice input";
  } else if (isSpeaking) {
    icon = "graphic_eq";
    colorClasses = "text-emerald-400";
    ariaLabel = "CLEO is speaking. Start talking to interrupt.";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isProcessing || isSpeaking}
      aria-label={ariaLabel}
      className={`relative transition-all duration-500 ${colorClasses} ${
        disabled || isProcessing || isSpeaking
          ? "opacity-30 cursor-not-allowed"
          : "hover:scale-110 active:scale-95 cursor-pointer"
      }`}
    >
      {/* Pulsing ring when listening */}
      {pulseRing && (
        <>
          <span className="absolute inset-0 -m-2 rounded-full border border-purple-400/40 animate-ping" />
          <span className="absolute inset-0 -m-1 rounded-full border border-purple-400/20 animate-pulse" />
        </>
      )}

      <span className="material-symbols-outlined font-light relative z-10">
        {icon}
      </span>
    </button>
  );
}
