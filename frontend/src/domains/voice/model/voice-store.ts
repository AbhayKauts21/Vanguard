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
  /** Error message if something goes wrong. */
  error: string | null;
  /** Whether the browser supports speech recognition. */
  isSupported: boolean;

  /* ── Actions ── */

  /** Enter voice mode — begin listening. */
  startVoiceMode: () => void;
  /** Exit voice mode — full reset. */
  stopVoiceMode: () => void;
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
      phase: "listening",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
    }),

  stopVoiceMode: () => set({ ...INITIAL_STATE }),

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
      // If error during active session, stay in voice mode but halt phase
      ...(error && s.isVoiceMode ? { phase: "idle" as VoicePhase } : {}),
    })),

  setSupported: (supported) => set({ isSupported: supported }),

  reset: () => set({ ...INITIAL_STATE }),
}));
