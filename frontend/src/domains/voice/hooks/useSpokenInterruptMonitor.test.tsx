import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpokenInterruptMonitor } from "./useSpokenInterruptMonitor";
import type { STTResult } from "@/domains/voice/model";

const mocks = vi.hoisted(() => ({
  recognitionCallbacks: null as
    | {
        onStart: () => void;
        onEnd: () => void;
        onError: (error: string) => void;
        onResult: (result: STTResult) => void;
      }
    | null,
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/domains/voice/engine", () => ({
  STTEngine: class {
    start(callbacks: typeof mocks.recognitionCallbacks) {
      mocks.recognitionCallbacks = callbacks;
      mocks.start();
      callbacks?.onStart();
    }

    stop() {
      mocks.stop();
      return "";
    }
  },
  isSpeechRecognitionSupported: () => true,
}));

vi.mock("@/lib/env", () => ({
  env: {
    voice: {
      sttLanguage: "en-US",
    },
  },
}));

describe("useSpokenInterruptMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.recognitionCallbacks = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start recognition until speaking playback has been armed", () => {
    renderHook(() =>
      useSpokenInterruptMonitor({
        active: true,
        speaking: true,
        armedAt: null,
        getSpokenText: () => "Here is the answer I found.",
        onInterruptIntent: vi.fn(),
      }),
    );

    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts recognition once armed and closes the listening window automatically", () => {
    renderHook(() =>
      useSpokenInterruptMonitor({
        active: true,
        speaking: true,
        armedAt: 0,
        getSpokenText: () => "Here is the answer I found.",
        onInterruptIntent: vi.fn(),
      }),
    );

    expect(mocks.start).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it("ignores pure interrupt keywords that match the assistant's spoken audio", () => {
    const onInterruptIntent = vi.fn();

    renderHook(() =>
      useSpokenInterruptMonitor({
        active: true,
        speaking: true,
        armedAt: 0,
        getSpokenText: () => "Please stop there for a second.",
        onInterruptIntent,
      }),
    );

    act(() => {
      mocks.recognitionCallbacks?.onResult({
        transcript: "stop",
        isFinal: true,
        confidence: 0.92,
      });
    });

    expect(onInterruptIntent).not.toHaveBeenCalled();
  });

  it("forwards real keyword interruptions with follow-up text", () => {
    const onInterruptIntent = vi.fn();
    const onTranscriptCandidate = vi.fn();

    renderHook(() =>
      useSpokenInterruptMonitor({
        active: true,
        speaking: true,
        armedAt: 0,
        getSpokenText: () => "Here is the answer I found.",
        onTranscriptCandidate,
        onInterruptIntent,
      }),
    );

    act(() => {
      mocks.recognitionCallbacks?.onResult({
        transcript: "okay cleo compare pricing",
        isFinal: true,
        confidence: 0.94,
      });
    });

    expect(onTranscriptCandidate).toHaveBeenCalledWith("okay cleo compare pricing");
    expect(onInterruptIntent).toHaveBeenCalledWith("compare pricing");
  });
});
