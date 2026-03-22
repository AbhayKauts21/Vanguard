/**
 * useAvatarState — read-only convenience hook for the avatar visual state machine.
 *
 * State transitions (integration plan §8.8):
 *
 *   ┌───────────┐
 *   │DISCONNECTED│
 *   └─────┬─────┘
 *         │ connect()
 *   ┌─────▼─────┐
 *   │   IDLE     │◄───────────┐
 *   │ (breathing)│            │
 *   └─────┬─────┘            │
 *         │ user sends msg    │ speak() done
 *   ┌─────▼─────┐            │
 *   │ LISTENING  │            │
 *   │ (head tilt)│            │
 *   └─────┬─────┘            │
 *         │ stream done       │
 *   ┌─────▼─────┐            │
 *   │ SPEAKING   ├────────────┘
 *   │ (lip-sync) │
 *   └───────────┘
 *
 * The store (`avatar-store.ts`) owns the state; this hook simply surfaces
 * derived booleans so components don't couple to the store shape directly.
 */

import { useAvatarStore } from "../model/avatar-store";
import type { AvatarVisualState } from "../model/types";

export interface AvatarStateInfo {
  /** Raw state value. */
  state: AvatarVisualState;
  /** True while the avatar is actively lip-syncing. */
  isSpeaking: boolean;
  /** True while avatar waits for the streamed answer. */
  isListening: boolean;
  /** True when connected and not speaking/listening. */
  isIdle: boolean;
  /** True when the WebRTC session is not established. */
  isDisconnected: boolean;
  /** True when an unrecoverable error occurred. */
  isError: boolean;
}

/**
 * Derive convenient booleans from the avatar visual state.
 * Components can destructure only what they need.
 */
export function useAvatarState(): AvatarStateInfo {
  const state = useAvatarStore((s) => s.currentState) as AvatarVisualState;

  return {
    state,
    isSpeaking: state === "speaking",
    isListening: state === "listening",
    isIdle: state === "idle",
    isDisconnected: state === "disconnected",
    isError: state === "error",
  };
}
