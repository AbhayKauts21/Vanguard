import { create } from "zustand";

export type AvatarState = "disconnected" | "idle" | "listening" | "speaking" | "error";

interface AvatarStore {
  isConnected: boolean;
  isLoading: boolean;
  currentState: AvatarState;
  error: string | null;
  speakFn: ((text: string) => Promise<void>) | null;
  // Actions
  setConnectionStatus: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setState: (state: AvatarState) => void;
  setError: (error: string | null) => void;
  setSpeakFn: (fn: ((text: string) => Promise<void>) | null) => void;
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  isConnected: false,
  isLoading: false,
  currentState: "disconnected",
  error: null,
  speakFn: null,
  
  setConnectionStatus: (connected) => set({ isConnected: connected, currentState: connected ? "idle" : "disconnected" }),
  setLoading: (loading) => set({ isLoading: loading }),
  setState: (state) => set({ currentState: state }),
  setError: (error) => set({ error: error, currentState: error ? "error" : "disconnected" }),
  setSpeakFn: (fn) => set({ speakFn: fn }),
}));
