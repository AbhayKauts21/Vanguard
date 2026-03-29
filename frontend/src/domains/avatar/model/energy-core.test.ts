import { describe, expect, it } from "vitest";
import { deriveEnergyCoreState, type EnergyCoreInputs } from "./energy-core";

const DEFAULTS: EnergyCoreInputs = {
  avatarState: "idle",
  isThinking: false,
  hasStreamingMessage: false,
  hasSpeechHold: false,
  voicePhase: "idle",
};

function derive(overrides: Partial<EnergyCoreInputs> = {}) {
  return deriveEnergyCoreState({ ...DEFAULTS, ...overrides });
}

describe("deriveEnergyCoreState", () => {
  // ── Text-mode tests (original) ────────────────────────

  it("prefers speech while the avatar is speaking", () => {
    expect(derive({ avatarState: "speaking", isThinking: true })).toBe("speech");
  });

  it("prefers speech while an assistant response is streaming", () => {
    expect(derive({ isThinking: true, hasStreamingMessage: true })).toBe("speech");
  });

  it("shows syncing while CLEO is waiting on a response", () => {
    expect(derive({ isThinking: true })).toBe("syncing");
  });

  it("shows syncing while the avatar is in listening mode", () => {
    expect(derive({ avatarState: "listening" })).toBe("syncing");
  });

  it("holds speech briefly after a completed answer", () => {
    expect(derive({ hasSpeechHold: true })).toBe("speech");
  });

  it("falls back to idle when no active lifecycle state is present", () => {
    expect(derive()).toBe("idle");
  });

  // ── Voice-mode tests (Phase V1+) ─────────────────────

  it("returns listening when voicePhase is listening", () => {
    expect(derive({ voicePhase: "listening" })).toBe("listening");
  });

  it("voice listening overrides text-mode syncing", () => {
    expect(derive({ voicePhase: "listening", isThinking: true })).toBe("listening");
  });

  it("voice listening overrides text-mode speech", () => {
    expect(derive({ voicePhase: "listening", hasStreamingMessage: true })).toBe("listening");
  });

  it("returns syncing when voicePhase is processing", () => {
    expect(derive({ voicePhase: "processing" })).toBe("syncing");
  });

  it("returns speech when voicePhase is speaking", () => {
    expect(derive({ voicePhase: "speaking" })).toBe("speech");
  });

  it("voicePhase idle falls through to text-mode logic", () => {
    expect(derive({ voicePhase: "idle", isThinking: true })).toBe("syncing");
  });

  it("handles undefined voicePhase gracefully (defaults to idle)", () => {
    expect(derive({ voicePhase: undefined })).toBe("idle");
  });
});
