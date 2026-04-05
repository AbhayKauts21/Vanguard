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
}));

vi.mock("./useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    start: mocks.startSTT,
    stop: mocks.stopSTT,
  }),
}));

vi.mock("./useAudioAnalyser", () => ({
  useAudioAnalyser: () => ({
    enqueueAudio: mocks.enqueueAudio,
    stopAudio: mocks.stopAudio,
    resetAudio: mocks.resetAudio,
    resumeAudio: mocks.resumeAudio,
    isPlaying: mocks.isPlaying,
  }),
}));

vi.mock("./useBargeInMonitor", () => ({
  useBargeInMonitor: () => undefined,
}));

vi.mock("./useSpokenInterruptMonitor", () => ({
  useSpokenInterruptMonitor: () => undefined,
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
    });

    await act(async () => {
      await result.current.interruptCurrentTurn();
    });

    expect(mocks.stopAudio).toHaveBeenCalled();
    expect(mocks.cancelBrowserTTS).toHaveBeenCalled();
    expect(mocks.startSTT).toHaveBeenCalled();
    expect(useVoiceStore.getState().isVoiceMode).toBe(true);
    expect(useVoiceStore.getState().phase).toBe("listening");
  });

  it("preserves a spoken interrupt phrase as the start of the next turn", async () => {
    const { result } = renderHook(() => useVoiceMode());

    act(() => {
      useVoiceStore.getState().startVoiceMode();
      useVoiceStore.getState().setPhase("speaking");
    });

    await act(async () => {
      await result.current.interruptCurrentTurn("okay can you compare that");
    });

    expect(mocks.startSTT).toHaveBeenCalledWith({
      seedTranscript: "okay can you compare that",
    });
    expect(useVoiceStore.getState().userTranscript).toBe(
      "okay can you compare that",
    );
    expect(useVoiceStore.getState().phase).toBe("listening");
  });
});
