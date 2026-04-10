import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceStore } from "@/domains/voice/model";
import { useSpeechRecognition } from "./useSpeechRecognition";

const mocks = vi.hoisted(() => ({
  supported: true,
  callbacks: null as
    | {
        onResult: (result: {
          transcript: string;
          isFinal: boolean;
          confidence: number;
        }) => void;
        onError: (error: string) => void;
        onEnd: () => void;
        onStart: () => void;
      }
    | null,
  stop: vi.fn(() => ""),
}));

vi.mock("@/domains/voice/engine", () => ({
  isSpeechRecognitionSupported: () => mocks.supported,
  STTEngine: class {
    start(callbacks: (typeof mocks)["callbacks"]) {
      mocks.callbacks = callbacks;
      callbacks?.onStart();
    }

    stop() {
      return mocks.stop();
    }
  },
}));

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    mocks.supported = true;
    mocks.callbacks = null;
    mocks.stop.mockReset();
    useVoiceStore.getState().reset();
  });

  it("reports unsupported browsers without hanging the voice store", () => {
    mocks.supported = false;
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    expect(useVoiceStore.getState().isSupported).toBe(false);
    expect(useVoiceStore.getState().error).toBe(
      "Speech recognition is not supported in this browser.",
    );
  });

  it("surfaces microphone permission errors from the browser STT engine", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      result.current.start();
    });

    act(() => {
      mocks.callbacks?.onError(
        "Microphone access was denied. Please allow microphone permissions.",
      );
    });

    expect(useVoiceStore.getState().error).toBe(
      "Microphone access was denied. Please allow microphone permissions.",
    );
    expect(useVoiceStore.getState().phase).toBe("session_open");
  });
});
