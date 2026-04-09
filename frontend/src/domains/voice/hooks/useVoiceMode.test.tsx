import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceStore } from "@/domains/voice/model";
import { useChatStore } from "@/domains/chat/model";
import { useAuthStore } from "@/domains/auth/model";
import { useVoiceMode } from "./useVoiceMode";

const mocks = vi.hoisted(() => ({
  startSTT: vi.fn(),
  stopSTT: vi.fn(),
  enqueueAudio: vi.fn(),
  stopAudio: vi.fn(),
  resetAudio: vi.fn(),
  resumeAudio: vi.fn().mockResolvedValue(undefined),
  isPlaying: vi.fn(() => false),
  synthesizeSpeech: vi.fn(),
  speakWithBrowserTTS: vi.fn(),
  cancelBrowserTTS: vi.fn(),
  apiStream: vi.fn(),
  consumeSSEStream: vi.fn(),
  audioAnalyserOptions: null as
    | {
        onChunkStart?: (index: number) => void;
        onQueueDrained?: () => void;
      }
    | null,
  bargeInOptions: null as
    | {
        active: boolean;
        speaking: boolean;
        onSpeechDetected: () => void;
      }
    | null,
  spokenInterruptOptions: null as
    | {
        onTranscriptCandidate?: (transcript: string) => void;
        onInterruptIntent: (seedTranscript: string) => void;
      }
    | null,
}));

vi.mock("./useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    start: mocks.startSTT,
    stop: mocks.stopSTT,
  }),
}));

vi.mock("./useAudioAnalyser", () => ({
  useAudioAnalyser: (options: {
    onChunkStart?: (index: number) => void;
    onQueueDrained?: () => void;
  }) => {
    mocks.audioAnalyserOptions = options;
    return {
      enqueueAudio: mocks.enqueueAudio,
      stopAudio: mocks.stopAudio,
      resetAudio: mocks.resetAudio,
      resumeAudio: mocks.resumeAudio,
      isPlaying: mocks.isPlaying,
    };
  },
}));

vi.mock("./useBargeInMonitor", () => ({
  useBargeInMonitor: (options: {
    active: boolean;
    speaking: boolean;
    onSpeechDetected: () => void;
  }) => {
    mocks.bargeInOptions = options;
    return undefined;
  },
}));

vi.mock("./useSpokenInterruptMonitor", () => ({
  useSpokenInterruptMonitor: (options: {
    onTranscriptCandidate?: (transcript: string) => void;
    onInterruptIntent: (seedTranscript: string) => void;
  }) => {
    mocks.spokenInterruptOptions = options;
    return undefined;
  },
}));

vi.mock("@/domains/voice/engine", () => ({
  synthesizeSpeech: mocks.synthesizeSpeech,
  speakWithBrowserTTS: mocks.speakWithBrowserTTS,
  cancelBrowserTTS: mocks.cancelBrowserTTS,
}));

vi.mock("@/lib/api", () => ({
  api: {
    stream: mocks.apiStream,
  },
  consumeSSEStream: mocks.consumeSSEStream,
}));

vi.mock("@/domains/chat/api", () => ({
  createPersistedChat: vi.fn(),
}));

describe("useVoiceMode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.audioAnalyserOptions = null;
    mocks.bargeInOptions = null;
    mocks.spokenInterruptOptions = null;

    useVoiceStore.getState().reset();
    useChatStore.setState({
      mode: "guest",
      messages: [],
      guestMessages: [],
      activeChatId: null,
      messageCache: {},
      chatSummaries: [],
      messagePageInfo: {},
      streamingMessageId: null,
      isThinking: false,
      errorType: null,
      conversationId: "guest-conversation",
      guestConversationId: "guest-conversation",
    });
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts playback from backend-prepared audio and keeps the short spoken text out of visible transcript state", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer. Next step?",
          voice_audio_base64: Buffer.from("audio").toString("base64"),
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full ");
        onToken("grounded ");
        onToken("answer.");
        onDone({
          type: "done",
          primary_citations: [],
          secondary_citations: [],
          all_citations: [],
          hidden_sources_count: 0,
          mode_used: "rag",
          max_confidence: 0.91,
          voice_response: "Short spoken answer. Next step?",
        });
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const pending = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(800);
      await pending;
    });

    expect(mocks.enqueueAudio).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueAudio.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().cleoTranscript).toBe("");
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("falls back to frontend TTS when prepared voice audio is unavailable", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.synthesizeSpeech.mockResolvedValue(new Blob(["audio"]));
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer. Next step?",
          voice_audio_base64: "",
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full grounded answer.");
        onDone({
          type: "done",
          primary_citations: [],
          secondary_citations: [],
          all_citations: [],
          hidden_sources_count: 0,
          mode_used: "rag",
          max_confidence: 0.91,
          voice_response: "Short spoken answer. Next step?",
        });
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const pending = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(800);
      await pending;
    });

    expect(mocks.synthesizeSpeech.mock.calls.map((call) => call[0])).toEqual([
      "Short spoken answer.",
      "Next step?",
    ]);
    expect(mocks.enqueueAudio).toHaveBeenCalledTimes(2);
  });

  it("interrupts the current turn and returns to listening without ending voice mode", async () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
      useVoiceStore.getState().setAudioLevel(0.64);
    });

    await act(async () => {
      await result.current.interruptCurrentTurn();
    });

    expect(mocks.resetAudio).toHaveBeenCalled();
    expect(mocks.resumeAudio).toHaveBeenCalled();
    expect(mocks.cancelBrowserTTS).toHaveBeenCalled();
    expect(mocks.startSTT).toHaveBeenCalled();
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
    expect(useVoiceStore.getState().audioLevel).toBe(0);
  });

  it("preserves a spoken interrupt phrase as the start of the next turn", async () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
    });

    await act(async () => {
      await result.current.interruptCurrentTurn("can you compare that");
    });

    expect(mocks.startSTT).toHaveBeenCalledWith({
      seedTranscript: "can you compare that",
    });
    expect(useVoiceStore.getState().userTranscript).toBe(
      "can you compare that",
    );
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("interrupts from processing, preserving any partial assistant message", async () => {
    const { result, rerender } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("processing");
      useChatStore.setState({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "Partial answer",
            isStreaming: true,
          },
        ],
        guestMessages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "Partial answer",
            isStreaming: true,
          },
        ],
        streamingMessageId: "assistant-1",
        isThinking: true,
      });
    });
    rerender();

    await act(async () => {
      await result.current.interruptCurrentTurn();
    });

    expect(mocks.resetAudio).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).toHaveBeenCalled();
    expect(useChatStore.getState().streamingMessageId).toBeNull();
    expect(useChatStore.getState().messages[0]).toMatchObject({
      content: "Partial answer",
      isStreaming: false,
    });
    expect(useVoiceStore.getState().phase).toBe("listening");
    expect(useChatStore.getState().isThinking).toBe(false);
  });

  it("does nothing when interrupt is requested while idle or listening", async () => {
    const { result } = renderHook(() => useVoiceMode());

    await act(async () => {
      await result.current.interruptCurrentTurn();
    });

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("listening");
    });

    await act(async () => {
      await result.current.interruptCurrentTurn();
    });

    expect(mocks.resetAudio).not.toHaveBeenCalled();
    expect(mocks.cancelBrowserTTS).not.toHaveBeenCalled();
    expect(mocks.startSTT).not.toHaveBeenCalled();
  });

  it("treats repeated interrupts as idempotent", async () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
    });

    await act(async () => {
      await result.current.interruptCurrentTurn();
      await result.current.interruptCurrentTurn();
    });

    expect(mocks.resetAudio).toHaveBeenCalledTimes(1);
    expect(mocks.cancelBrowserTTS).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("waits for a spoken interrupt keyword instead of cutting off on speech energy alone", () => {
    const { rerender } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
    });
    rerender();

    act(() => {
      mocks.bargeInOptions?.onSpeechDetected();
    });

    expect(mocks.resetAudio).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().phase).toBe("speaking");

    act(() => {
      mocks.spokenInterruptOptions?.onInterruptIntent("compare pricing");
    });

    expect(mocks.resetAudio).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).toHaveBeenLastCalledWith({
      seedTranscript: "compare pricing",
    });
  });

  it("does not seed the next turn when the interrupt was only a pure keyword", () => {
    const { rerender } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
    });
    rerender();

    act(() => {
      mocks.spokenInterruptOptions?.onInterruptIntent("");
    });

    expect(useVoiceStore.getState().phase).toBe("listening");
    expect(useVoiceStore.getState().userTranscript).toBe("");
    expect(useVoiceStore.getState().finalTranscript).toBe("");
    expect(mocks.startSTT).toHaveBeenLastCalledWith();
  });

  it("enters speaking from the audio queue chunk-start callback and stays interruptible", async () => {
    const { result, rerender } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("processing");
    });
    rerender();

    act(() => {
      mocks.audioAnalyserOptions?.onChunkStart?.(0);
    });
    rerender();

    expect(useVoiceStore.getState().phase).toBe("speaking");
    expect(mocks.spokenInterruptOptions).not.toBeNull();

    await act(async () => {
      await result.current.interruptCurrentTurn();
    });

    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("enters speaking before browser TTS fallback playback begins", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.synthesizeSpeech.mockResolvedValue(new Blob([]));
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer.",
          voice_audio_base64: "",
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full grounded answer.");
        onDone({
          type: "done",
          primary_citations: [],
          secondary_citations: [],
          all_citations: [],
          hidden_sources_count: 0,
          mode_used: "rag",
          max_confidence: 0.91,
          voice_response: "Short spoken answer.",
        });
      },
    );

    mocks.speakWithBrowserTTS.mockImplementation(
      async (text: string) => {
        expect(text).toBe("Short spoken answer.");
        expect(useVoiceStore.getState().phase).toBe("speaking");
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const pending = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(800);
      await pending;
    });

    expect(mocks.speakWithBrowserTTS).toHaveBeenCalledWith(
      "Short spoken answer.",
    );
    expect(useVoiceStore.getState().phase).toBe("listening");
  });
});
