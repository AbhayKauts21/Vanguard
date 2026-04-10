import { create } from "zustand";
import type { VoicePhase } from "./types";

interface VoiceState {
  /* ── State ── */

  /** Whether voice mode is currently active (mic open or speaking). */
  isVoiceMode: boolean;
  /** Current phase of the voice pipeline. */
  phase: VoicePhase;
  /** Live transcript of what the user is saying (interim + final). */
  userTranscript: string;
  /** Final confirmed transcript sent to the chat pipeline. */
  finalTranscript: string;
  /** Live transcript of what CLEO is saying (accumulated from TTS). */
  cleoTranscript: string;
  /** Normalized audio output level 0-1 for energy core sync. */
  audioLevel: number;
  /** Monotonic session token for guarding async voice callbacks. */
  sessionId: number;
  /** Monotonic turn token for guarding async voice callbacks. */
  turnId: number;
  /** Count of stale callbacks ignored in the current session. */
  staleEventCount: number;
  /** Error message if something goes wrong. */
  error: string | null;
  /** Whether the browser supports speech recognition. */
  isSupported: boolean;

  /* ── Actions ── */

  /** Open the session and leave it ready for the next listen cycle. */
  startVoiceMode: () => void;
  /** Open a fresh session and advance the async guard tokens. */
  openSession: () => { sessionId: number; turnId: number };
  /** Exit voice mode — full reset. */
  stopVoiceMode: () => void;
  /** Advance the active turn token for a new request or interrupt. */
  advanceTurn: () => number;
  /** Invalidate the current session so late callbacks are ignored. */
  invalidateSession: () => { previousSessionId: number; nextSessionId: number };
  /** Track an ignored stale event and return the updated count. */
  incrementStaleEventCount: () => number;
  /** Transition to a specific phase. */
  setPhase: (phase: VoicePhase) => void;
  /** Update the live user transcript (interim results). */
  setUserTranscript: (transcript: string) => void;
  /** Lock in the final user transcript before sending to chat. */
  setFinalTranscript: (transcript: string) => void;
  /** Update CLEO's spoken text as TTS progresses. */
  setCleoTranscript: (transcript: string) => void;
  /** Append to CLEO's transcript (sentence by sentence). */
  appendCleoTranscript: (text: string) => void;
  /** Set the real-time audio level for avatar reactivity (0-1). */
  setAudioLevel: (level: number) => void;
  /** Set an error and optionally stop voice mode. */
  setError: (error: string | null) => void;
  /** Set browser support flag. */
  setSupported: (supported: boolean) => void;
  /** Full reset to idle defaults. */
  reset: () => void;
}

const INITIAL_STATE = {
  isVoiceMode: false,
  phase: "idle" as VoicePhase,
  userTranscript: "",
  finalTranscript: "",
  cleoTranscript: "",
  audioLevel: 0,
  sessionId: 0,
  turnId: 0,
  staleEventCount: 0,
  error: null,
  isSupported: true,
};

/**
 * Zustand store for the voice-to-voice pipeline.
 *
 * Drives:
 * - VoiceModeButton state
 * - VoiceTranscript overlay text
 * - Energy core avatar sync (via audioLevel + phase)
 * - Composer disable state in voice mode
 */
export const useVoiceStore = create<VoiceState>((set) => ({
  ...INITIAL_STATE,

  startVoiceMode: () =>
    set({
      isVoiceMode: true,
      phase: "session_open",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
    }),

  openSession: () => {
    let sessionId = 0;
    let turnId = 0;

    set((s) => {
      sessionId = s.sessionId + 1;
      turnId = s.turnId + 1;

      return {
        isVoiceMode: true,
        phase: "session_open" as VoicePhase,
        userTranscript: "",
        finalTranscript: "",
        cleoTranscript: "",
        audioLevel: 0,
        sessionId,
        turnId,
        staleEventCount: 0,
        error: null,
      };
    });

    return { sessionId, turnId };
  },

  stopVoiceMode: () => set({ ...INITIAL_STATE }),

  advanceTurn: () => {
    let turnId = 0;

    set((s) => {
      turnId = s.turnId + 1;
      return { turnId };
    });

    return turnId;
  },

  invalidateSession: () => {
    let previousSessionId = 0;
    let nextSessionId = 0;

    set((s) => {
      previousSessionId = s.sessionId;
      nextSessionId = s.sessionId + 1;

      return {
        sessionId: nextSessionId,
        turnId: s.turnId + 1,
      };
    });

    return {
      previousSessionId,
      nextSessionId,
    };
  },

  incrementStaleEventCount: () => {
    let staleEventCount = 0;

    set((s) => {
      staleEventCount = s.staleEventCount + 1;
      return { staleEventCount };
    });

    return staleEventCount;
  },

  setPhase: (phase) => set({ phase }),

  setUserTranscript: (transcript) => set({ userTranscript: transcript }),

  setFinalTranscript: (transcript) => set({ finalTranscript: transcript }),

  setCleoTranscript: (transcript) => set({ cleoTranscript: transcript }),

  appendCleoTranscript: (text) =>
    set((s) => ({
      cleoTranscript: s.cleoTranscript
        ? `${s.cleoTranscript} ${text}`
        : text,
    })),

  setAudioLevel: (level) => set({ audioLevel: level }),

  setError: (error) =>
    set((s) => ({
      error,
      // Keep the session open after failures so the user can retry or end it manually.
      ...(error && s.isVoiceMode && s.phase !== "session_closing"
        ? { phase: "session_open" as VoicePhase }
        : {}),
    })),

  setSupported: (supported) => set({ isSupported: supported }),

  reset: () => set({ ...INITIAL_STATE }),
}));
