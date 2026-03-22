import { create } from "zustand";
import type { AvatarVisualState } from "./types";

// Re-export for convenience so existing imports keep working.
export type AvatarState = AvatarVisualState;

interface AvatarStore {
  // State
  isConnected: boolean;
  isLoading: boolean;
  isMuted: boolean;
  currentState: AvatarVisualState;
  error: string | null;
  speakFn: ((text: string) => Promise<void>) | null;

  // Actions
  setConnectionStatus: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setState: (state: AvatarVisualState) => void;
  setError: (error: string | null) => void;
  setSpeakFn: (fn: ((text: string) => Promise<void>) | null) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  isConnected: false,
  isLoading: false,
  isMuted: false,
  currentState: "disconnected",
  error: null,
  speakFn: null,

  setConnectionStatus: (connected) =>
    set({ isConnected: connected, currentState: connected ? "idle" : "disconnected" }),
  setLoading: (loading) => set({ isLoading: loading }),
  setState: (state) => set({ currentState: state }),
  setError: (error) =>
    set({ error, currentState: error ? "error" : "disconnected" }),
  setSpeakFn: (fn) => set({ speakFn: fn }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setMuted: (muted) => set({ isMuted: muted }),
}));
