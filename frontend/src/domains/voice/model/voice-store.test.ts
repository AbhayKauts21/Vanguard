/**
 * Unit tests for the voice Zustand store.
 *
 * Tests cover:
 * - Initial state
 * - Voice mode lifecycle (start → phase transitions → stop)
 * - Transcript management
 * - Audio level updates
 * - Error handling
 * - Reset behavior
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useVoiceStore } from "@/domains/voice/model";

describe("useVoiceStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useVoiceStore.getState().reset();
  });

  describe("initial state", () => {
    it("should have voice mode disabled by default", () => {
      const state = useVoiceStore.getState();
      expect(state.isVoiceMode).toBe(false);
      expect(state.phase).toBe("idle");
    });

    it("should have empty transcripts", () => {
      const state = useVoiceStore.getState();
      expect(state.userTranscript).toBe("");
      expect(state.finalTranscript).toBe("");
      expect(state.cleoTranscript).toBe("");
    });

    it("should have zero audio level", () => {
      expect(useVoiceStore.getState().audioLevel).toBe(0);
    });

    it("should have no error", () => {
      expect(useVoiceStore.getState().error).toBeNull();
    });

    it("should report browser as supported by default", () => {
      expect(useVoiceStore.getState().isSupported).toBe(true);
    });
  });

  describe("startVoiceMode", () => {
    it("should activate voice mode and set phase to listening", () => {
      useVoiceStore.getState().startVoiceMode();

      const state = useVoiceStore.getState();
      expect(state.isVoiceMode).toBe(true);
      expect(state.phase).toBe("listening");
    });

    it("should clear all transcripts on start", () => {
      const store = useVoiceStore.getState();
      store.setUserTranscript("previous text");
      store.setCleoTranscript("previous response");
      store.startVoiceMode();

      const state = useVoiceStore.getState();
      expect(state.userTranscript).toBe("");
      expect(state.finalTranscript).toBe("");
      expect(state.cleoTranscript).toBe("");
    });

    it("should clear audio level and error on start", () => {
      const store = useVoiceStore.getState();
      store.setAudioLevel(0.7);
      store.setError("previous error");
      store.startVoiceMode();

      const state = useVoiceStore.getState();
      expect(state.audioLevel).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe("stopVoiceMode", () => {
    it("should fully reset to initial state", () => {
      const store = useVoiceStore.getState();
      store.startVoiceMode();
      store.setPhase("speaking");
      store.setUserTranscript("hello");
      store.setCleoTranscript("hi there");
      store.setAudioLevel(0.5);

      store.stopVoiceMode();

      const state = useVoiceStore.getState();
      expect(state.isVoiceMode).toBe(false);
      expect(state.phase).toBe("idle");
      expect(state.userTranscript).toBe("");
      expect(state.cleoTranscript).toBe("");
      expect(state.audioLevel).toBe(0);
    });
  });

  describe("phase transitions", () => {
    it("should transition through the full lifecycle", () => {
      const store = useVoiceStore.getState();

      store.startVoiceMode();
      expect(useVoiceStore.getState().phase).toBe("listening");

      store.setPhase("processing");
      expect(useVoiceStore.getState().phase).toBe("processing");

      store.setPhase("speaking");
      expect(useVoiceStore.getState().phase).toBe("speaking");

      store.setPhase("idle");
      expect(useVoiceStore.getState().phase).toBe("idle");
    });
  });

  describe("transcript management", () => {
    it("should update user transcript", () => {
      useVoiceStore.getState().setUserTranscript("testing one two three");
      expect(useVoiceStore.getState().userTranscript).toBe("testing one two three");
    });

    it("should lock final transcript separately from interim", () => {
      const store = useVoiceStore.getState();
      store.setUserTranscript("interim...");
      store.setFinalTranscript("final version");

      const state = useVoiceStore.getState();
      expect(state.userTranscript).toBe("interim...");
      expect(state.finalTranscript).toBe("final version");
    });

    it("should set CLEO transcript directly", () => {
      useVoiceStore.getState().setCleoTranscript("Hello there.");
      expect(useVoiceStore.getState().cleoTranscript).toBe("Hello there.");
    });

    it("should append to CLEO transcript sentence by sentence", () => {
      const store = useVoiceStore.getState();
      store.appendCleoTranscript("First sentence.");
      store.appendCleoTranscript("Second sentence.");

      expect(useVoiceStore.getState().cleoTranscript).toBe(
        "First sentence. Second sentence.",
      );
    });

    it("should handle first append to empty transcript without leading space", () => {
      useVoiceStore.getState().appendCleoTranscript("Only sentence.");
      expect(useVoiceStore.getState().cleoTranscript).toBe("Only sentence.");
    });
  });

  describe("audio level", () => {
    it("should clamp audio level between 0 and 1", () => {
      const store = useVoiceStore.getState();
      store.setAudioLevel(0.65);
      expect(useVoiceStore.getState().audioLevel).toBe(0.65);
    });

    it("should accept zero", () => {
      const store = useVoiceStore.getState();
      store.setAudioLevel(0.5);
      store.setAudioLevel(0);
      expect(useVoiceStore.getState().audioLevel).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should set an error message", () => {
      useVoiceStore.getState().setError("Microphone denied.");
      expect(useVoiceStore.getState().error).toBe("Microphone denied.");
    });

    it("should clear error with null", () => {
      const store = useVoiceStore.getState();
      store.setError("some error");
      store.setError(null);
      expect(useVoiceStore.getState().error).toBeNull();
    });
  });

  describe("browser support", () => {
    it("should update supported flag", () => {
      useVoiceStore.getState().setSupported(false);
      expect(useVoiceStore.getState().isSupported).toBe(false);
    });
  });

  describe("reset", () => {
    it("should restore all values to initial state", () => {
      const store = useVoiceStore.getState();
      store.startVoiceMode();
      store.setPhase("speaking");
      store.setUserTranscript("test");
      store.setCleoTranscript("response");
      store.setAudioLevel(0.8);
      store.setError("something broke");

      store.reset();

      const state = useVoiceStore.getState();
      expect(state.isVoiceMode).toBe(false);
      expect(state.phase).toBe("idle");
      expect(state.userTranscript).toBe("");
      expect(state.cleoTranscript).toBe("");
      expect(state.audioLevel).toBe(0);
      expect(state.error).toBeNull();
    });
  });
});
