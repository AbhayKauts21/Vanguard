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
  useAudioAnalyser: (options: { onChunkStart?: (index: number) => void }) => {
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

const POST_PLAYBACK_SETTLE_MS = 800;

function buildDoneEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: "done",
    primary_citations: [],
    secondary_citations: [],
    all_citations: [],
    hidden_sources_count: 0,
    mode_used: "rag",
    max_confidence: 0.91,
    voice_response: "Short spoken answer. Next step?",
    ...overrides,
  };
}

describe("useVoiceMode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.audioAnalyserOptions = null;

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
      isLoadingChats: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isHistoryCollapsed: false,
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

  it("opens one session and does not duplicate listening when activate is pressed twice", () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
      result.current.activate();
    });

    expect(mocks.startSTT).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("returns to listening after prepared audio finishes speaking", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.enqueueAudio.mockImplementation(() => {
      mocks.audioAnalyserOptions?.onChunkStart?.(0);
    });
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
        onDone(buildDoneEvent());
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const pending = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(POST_PLAYBACK_SETTLE_MS);
      await pending;
    });

    expect(mocks.enqueueAudio).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).toHaveBeenCalledTimes(2);
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
    expect(useChatStore.getState().messages.at(-1)?.content).toContain("Full grounded answer.");
  });

  it("supports multiple voice turns in one open session", async () => {
    mocks.stopSTT
      .mockReturnValueOnce("First question")
      .mockReturnValueOnce("Second question");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.enqueueAudio.mockImplementation(() => {
      mocks.audioAnalyserOptions?.onChunkStart?.(0);
    });
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer. Next step?",
          voice_audio_base64: Buffer.from("audio").toString("base64"),
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full answer.");
        onDone(buildDoneEvent());
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const firstTurn = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(POST_PLAYBACK_SETTLE_MS);
      await firstTurn;
    });

    expect(useVoiceStore.getState().phase).toBe("listening");

    await act(async () => {
      const secondTurn = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(POST_PLAYBACK_SETTLE_MS);
      await secondTurn;
    });

    expect(mocks.apiStream).toHaveBeenCalledTimes(2);
    expect(mocks.startSTT).toHaveBeenCalledTimes(3);
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("uses the backend voice summary verbatim for TTS fallback", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.synthesizeSpeech.mockResolvedValue(new Blob(["audio"]));
    mocks.enqueueAudio.mockImplementation(() => {
      mocks.audioAnalyserOptions?.onChunkStart?.(0);
    });
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer. Next step?",
          voice_audio_base64: "",
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full grounded answer.");
        onDone(buildDoneEvent());
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const pending = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(POST_PLAYBACK_SETTLE_MS);
      await pending;
    });

    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith(
      "Short spoken answer. Next step?",
      {},
      expect.any(Object),
    );
    expect(mocks.speakWithBrowserTTS).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("falls back to browser speech and returns to listening afterward", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.synthesizeSpeech.mockResolvedValue(new Blob([]));
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer.",
          voice_audio_base64: "",
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full grounded answer.");
        onDone(buildDoneEvent({ voice_response: "Short spoken answer." }));
      },
    );
    mocks.speakWithBrowserTTS.mockImplementation(async (text: string) => {
      expect(text).toBe("Short spoken answer.");
      expect(useVoiceStore.getState().phase).toBe("speaking");
    });

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      const pending = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(POST_PLAYBACK_SETTLE_MS);
      await pending;
    });

    expect(mocks.speakWithBrowserTTS).toHaveBeenCalledWith("Short spoken answer.");
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("interrupts manual speaking immediately and returns to listening without closing the session", () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
      result.current.interruptCurrentTurn();
    });

    expect(mocks.stopAudio).toHaveBeenCalledTimes(1);
    expect(mocks.cancelBrowserTTS).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("ignores repeated interrupt clicks safely", () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
      result.current.interruptCurrentTurn();
      result.current.interruptCurrentTurn();
    });

    expect(mocks.stopAudio).toHaveBeenCalledTimes(1);
    expect(mocks.cancelBrowserTTS).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("re-arms prepared audio playback after interrupt so the next question speaks again", async () => {
    let audioArmed = true;
    let speakingActive = false;
    let chunkStarts = 0;

    mocks.stopSTT
      .mockReturnValueOnce("First question")
      .mockReturnValueOnce("Follow-up question");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.isPlaying.mockImplementation(() => speakingActive);
    mocks.stopAudio.mockImplementation(() => {
      audioArmed = false;
      speakingActive = false;
    });
    mocks.resetAudio.mockImplementation(() => {
      audioArmed = true;
    });
    mocks.resumeAudio.mockImplementation(async () => {
      audioArmed = true;
    });
    mocks.enqueueAudio.mockImplementation(() => {
      if (!audioArmed) {
        return;
      }

      chunkStarts += 1;
      speakingActive = chunkStarts === 1;
      mocks.audioAnalyserOptions?.onChunkStart?.(chunkStarts - 1);
    });
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer.",
          voice_audio_base64: Buffer.from("audio").toString("base64"),
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full answer.");
        onDone(buildDoneEvent({ voice_response: "Short spoken answer." }));
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    let firstTurn!: Promise<void>;
    await act(async () => {
      firstTurn = result.current.sendVoiceMessage();
      await Promise.resolve();
    });

    expect(useVoiceStore.getState().phase).toBe("speaking");

    act(() => {
      result.current.interruptCurrentTurn();
    });

    expect(useVoiceStore.getState().phase).toBe("listening");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
      await firstTurn;
    });

    expect(chunkStarts).toBe(1);

    await act(async () => {
      const secondTurn = result.current.sendVoiceMessage();
      await vi.advanceTimersByTimeAsync(POST_PLAYBACK_SETTLE_MS);
      await secondTurn;
    });

    expect(chunkStarts).toBe(2);
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("does not reopen the mic before delayed prepared audio has actually started and finished", async () => {
    let speakingActive = false;

    mocks.stopSTT.mockReturnValue("Tell me about billing");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.isPlaying.mockImplementation(() => speakingActive);
    mocks.enqueueAudio.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            speakingActive = true;
            mocks.audioAnalyserOptions?.onChunkStart?.(0);

            setTimeout(() => {
              speakingActive = false;
            }, 500);

            resolve();
          }, 1000);
        }),
    );
    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        onVoiceReady?.({
          type: "voice_ready",
          voice_response: "Short spoken answer.",
          voice_audio_base64: Buffer.from("audio").toString("base64"),
          voice_audio_content_type: "audio/mpeg",
        });
        onToken("Full answer.");
        onDone(buildDoneEvent({ voice_response: "Short spoken answer." }));
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    let pendingTurn!: Promise<void>;
    await act(async () => {
      pendingTurn = result.current.sendVoiceMessage();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(useVoiceStore.getState().phase).toBe("processing");
    expect(mocks.startSTT).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(useVoiceStore.getState().phase).toBe("speaking");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
      await pendingTurn;
    });

    expect(useVoiceStore.getState().phase).toBe("listening");
    expect(mocks.startSTT).toHaveBeenCalledTimes(2);
  });

  it("closes the session cleanly when End Session is pressed during speaking", () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
      result.current.deactivate();
    });

    expect(mocks.stopAudio).toHaveBeenCalledTimes(1);
    expect(mocks.cancelBrowserTTS).toHaveBeenCalledTimes(1);
    expect(mocks.startSTT).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().isVoiceMode).toBe(false);
    expect(useVoiceStore.getState().phase).toBe("idle");
  });

  it("keeps the session open when the transcript is empty", async () => {
    mocks.stopSTT.mockReturnValue("");
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      await result.current.sendVoiceMessage();
    });

    expect(mocks.apiStream).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("session_open");
  });

  it("surfaces a controlled error while keeping the session open when no spoken summary is returned", async () => {
    mocks.stopSTT.mockReturnValue("How do I reset my password?");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);
    mocks.consumeSSEStream.mockImplementation(async (_response, onToken, onDone) => {
      onToken("Full grounded answer.");
      onDone(buildDoneEvent({ voice_response: "" }));
    });

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    await act(async () => {
      await result.current.sendVoiceMessage();
    });

    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("session_open");
    expect(useVoiceStore.getState().error).toContain("Voice playback unavailable");
  });

  it("ignores late stream callbacks after the session has been ended", async () => {
    mocks.stopSTT.mockReturnValue("What changed?");
    mocks.apiStream.mockResolvedValue({ ok: true } as Response);

    let resolveStream!: () => void;
    let lateDone: ((event: ReturnType<typeof buildDoneEvent>) => void) | null = null;
    let lateVoiceReady: ((event: {
      type: "voice_ready";
      voice_response: string;
      voice_audio_base64: string;
      voice_audio_content_type: string;
    }) => void) | null = null;

    mocks.consumeSSEStream.mockImplementation(
      async (_response, onToken, onDone, _onError, onVoiceReady) => {
        lateDone = onDone;
        lateVoiceReady = onVoiceReady ?? null;
        onToken("Partial answer");
        await new Promise<void>((resolve) => {
          resolveStream = resolve;
        });
      },
    );

    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      result.current.activate();
    });

    let pendingTurn!: Promise<void>;
    await act(async () => {
      pendingTurn = result.current.sendVoiceMessage();
      await Promise.resolve();
    });

    act(() => {
      result.current.deactivate();
    });

    act(() => {
      lateVoiceReady?.({
        type: "voice_ready",
        voice_response: "Late summary",
        voice_audio_base64: Buffer.from("audio").toString("base64"),
        voice_audio_content_type: "audio/mpeg",
      });
      lateDone?.(buildDoneEvent({ voice_response: "Late summary" }));
      resolveStream();
    });

    await act(async () => {
      await pendingTurn;
    });

    expect(mocks.enqueueAudio).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().isVoiceMode).toBe(false);
    expect(useVoiceStore.getState().phase).toBe("idle");
  });
});
