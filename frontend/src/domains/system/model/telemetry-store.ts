import { create } from "zustand";

/**
 * Lightweight telemetry store — tracks client-side response latency
 * and real-time metrics for the AvatarPanel telemetry badges.
 */

interface TelemetryState {
  /** Last measured time-to-first-token in milliseconds. */
  lastLatencyMs: number | null;
  /** Rolling average latency (last 10 responses). */
  avgLatencyMs: number | null;
  /** Total vectors in Pinecone (from /health/detailed). */
  vectorCount: number | null;
  /** Backend overall status. */
  backendStatus: "online" | "degraded" | "offline";

  /** Internal: latency history for rolling average. */
  _latencyHistory: number[];

  /** Record a new latency measurement. */
  recordLatency: (ms: number) => void;
  /** Set vector count from health endpoint. */
  setVectorCount: (count: number) => void;
  /** Set backend status. */
  setBackendStatus: (status: "online" | "degraded" | "offline") => void;
}

const MAX_HISTORY = 10;

export const useTelemetryStore = create<TelemetryState>((set) => ({
  lastLatencyMs: null,
  avgLatencyMs: null,
  vectorCount: null,
  backendStatus: "offline",
  _latencyHistory: [],

  recordLatency: (ms) =>
    set((s) => {
      const history = [...s._latencyHistory, ms].slice(-MAX_HISTORY);
      const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
      return {
        lastLatencyMs: Math.round(ms),
        avgLatencyMs: avg,
        _latencyHistory: history,
      };
    }),

  setVectorCount: (count) => set({ vectorCount: count }),
  setBackendStatus: (status) => set({ backendStatus: status }),
}));
