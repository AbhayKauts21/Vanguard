import type { AvatarVisualState } from "./types";

export type EnergyCoreVisualState = "idle" | "syncing" | "speech";

export interface EnergyCoreInputs {
  avatarState: AvatarVisualState;
  isThinking: boolean;
  hasStreamingMessage: boolean;
  hasSpeechHold: boolean;
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
}: EnergyCoreInputs): EnergyCoreVisualState {
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
