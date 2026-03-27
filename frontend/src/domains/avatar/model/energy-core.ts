import type { AvatarVisualState } from "./types";
import type { VoicePhase } from "@/domains/voice/model/types";

export type EnergyCoreVisualState = "idle" | "syncing" | "speech" | "listening";

export interface EnergyCoreInputs {
  avatarState: AvatarVisualState;
  isThinking: boolean;
  hasStreamingMessage: boolean;
  hasSpeechHold: boolean;
  /** Current voice pipeline phase (idle when voice mode is off). */
  voicePhase?: VoicePhase;
  /** Real-time audio level 0-1 from TTS playback for avatar reactivity. */
  voiceAudioLevel?: number;
}

/**
 * Resolve the current energy core state from the live chat/avatar lifecycle.
 * Priority order matters so active response output wins over background wait states.
 */
export function deriveEnergyCoreState({
  avatarState,
  isThinking,
  hasStreamingMessage,
  hasSpeechHold,
  voicePhase = "idle",
}: EnergyCoreInputs): EnergyCoreVisualState {
  // Voice mode phases take priority when active
  if (voicePhase === "listening") {
    return "listening";
  }

  if (voicePhase === "speaking") {
    return "speech";
  }

  if (voicePhase === "processing") {
    return "syncing";
  }

  // Existing text-mode logic
  if (avatarState === "speaking" || hasStreamingMessage) {
    return "speech";
  }

  if (isThinking || avatarState === "listening") {
    return "syncing";
  }

  if (hasSpeechHold) {
    return "speech";
  }

  return "idle";
}
