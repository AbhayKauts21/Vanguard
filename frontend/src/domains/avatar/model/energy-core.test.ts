import { describe, expect, it } from "vitest";
import { deriveEnergyCoreState } from "./energy-core";

describe("deriveEnergyCoreState", () => {
  it("prefers speech while the avatar is speaking", () => {
    expect(
      deriveEnergyCoreState({
        avatarState: "speaking",
        isThinking: true,
        hasStreamingMessage: false,
        hasSpeechHold: false,
      }),
    ).toBe("speech");
  });

  it("prefers speech while an assistant response is streaming", () => {
    expect(
      deriveEnergyCoreState({
        avatarState: "idle",
        isThinking: true,
        hasStreamingMessage: true,
        hasSpeechHold: false,
      }),
    ).toBe("speech");
  });

  it("shows syncing while CLEO is waiting on a response", () => {
    expect(
      deriveEnergyCoreState({
        avatarState: "idle",
        isThinking: true,
        hasStreamingMessage: false,
        hasSpeechHold: false,
      }),
    ).toBe("syncing");
  });

  it("shows syncing while the avatar is in listening mode", () => {
    expect(
      deriveEnergyCoreState({
        avatarState: "listening",
        isThinking: false,
        hasStreamingMessage: false,
        hasSpeechHold: false,
      }),
    ).toBe("syncing");
  });

  it("holds speech briefly after a completed answer", () => {
    expect(
      deriveEnergyCoreState({
        avatarState: "idle",
        isThinking: false,
        hasStreamingMessage: false,
        hasSpeechHold: true,
      }),
    ).toBe("speech");
  });

  it("falls back to idle when no active lifecycle state is present", () => {
    expect(
      deriveEnergyCoreState({
        avatarState: "idle",
        isThinking: false,
        hasStreamingMessage: false,
        hasSpeechHold: false,
      }),
    ).toBe("idle");
  });
});
