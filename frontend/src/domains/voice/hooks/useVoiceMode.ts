"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVoiceStore } from "@/domains/voice/model";
import { useChatStore } from "@/domains/chat/model";
import { useAuthStore } from "@/domains/auth/model";
import { createPersistedChat } from "@/domains/chat/api";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAudioAnalyser } from "./useAudioAnalyser";
import {
  cancelBrowserTTS,
  speakWithBrowserTTS,
  synthesizeSpeech,
} from "@/domains/voice/engine";
import { api, consumeSSEStream } from "@/lib/api";
import { CHATS_ENDPOINT, CHAT_STREAM_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, SSEDoneEvent, SSEVoiceReadyEvent } from "@/types";

const POST_PLAYBACK_SETTLE_MS = 800;
const EMPTY_ASSISTANT_METADATA = {
  primary_citations: [],
  secondary_citations: [],
  all_citations: [],
  hidden_sources_count: 0,
  mode_used: "rag" as const,
  max_confidence: 0,
};

function normalizeVoiceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodePreparedVoiceAudio(
  base64Audio: string,
  contentType: string,
): Blob | null {
  if (!base64Audio) {
    return null;
  }

  try {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], {
      type: contentType || "audio/mpeg",
    });
  } catch (error) {
    console.error("[VoiceMode] Failed to decode prepared voice audio:", error);
    return null;
  }
}

function logVoiceLifecycle(event: string, details: Record<string, unknown> = {}) {
  console.info("[VoiceMode]", event, details);
}

/**
 * Voice session controller for the persistent multi-turn session flow.
 *
 * Session lifecycle:
 *   idle -> session_open -> listening -> processing -> speaking -> session_open
 *                           \___________________________________________/
 *                                repeated turns within one session
 *
 * Session closure is always explicit via `deactivate()`.
 */
export function useVoiceMode() {
  const { start: startSTT, stop: stopSTT } = useSpeechRecognition();
  const setPhase = useVoiceStore((s) => s.setPhase);
  const setError = useVoiceStore((s) => s.setError);
  const setCleoTranscript = useVoiceStore((s) => s.setCleoTranscript);
  const setFinalTranscript = useVoiceStore((s) => s.setFinalTranscript);
  const setUserTranscript = useVoiceStore((s) => s.setUserTranscript);
  const openSession = useVoiceStore((s) => s.openSession);
  const advanceTurn = useVoiceStore((s) => s.advanceTurn);
  const invalidateSession = useVoiceStore((s) => s.invalidateSession);
  const incrementStaleEventCount = useVoiceStore((s) => s.incrementStaleEventCount);
  const stopVoiceMode = useVoiceStore((s) => s.stopVoiceMode);

  const { enqueueAudio, stopAudio, resetAudio, resumeAudio, isPlaying } =
    useAudioAnalyser({
      onChunkStart: () => {
        const state = useVoiceStore.getState();
        if (!state.isVoiceMode || state.phase === "session_closing") {
          return;
        }

        if (state.phase !== "speaking") {
          setPhase("speaking");
          const { sessionId, turnId } = useVoiceStore.getState();
          logVoiceLifecycle("speaking_started", {
            sessionId,
            turnId,
            transport: "prepared_audio",
          });
        }
      },
    });

  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendToken = useChatStore((s) => s.appendToken);
  const finishAssistantMessage = useChatStore((s) => s.finishAssistantMessage);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const upsertChatSummary = useChatStore((s) => s.upsertChatSummary);
  const setErrorType = useChatStore((s) => s.setErrorType);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const abortRef = useRef<AbortController | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const isActiveSession = useCallback((sessionId: number) => {
    const state = useVoiceStore.getState();
    return state.isVoiceMode && state.sessionId === sessionId;
  }, []);

  const isActiveTurn = useCallback(
    (sessionId: number, turnId: number) =>
      isActiveSession(sessionId) && useVoiceStore.getState().turnId === turnId,
    [isActiveSession],
  );

  const logStaleEvent = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      const ignoredCount = incrementStaleEventCount();
      logVoiceLifecycle("stale_event_ignored", {
        event,
        ignoredCount,
        ...details,
      });
    },
    [incrementStaleEventCount],
  );

  const waitForPlaybackToSettle = useCallback(
    async (sessionId: number, turnId: number) =>
      new Promise<void>((resolve) => {
        const poll = () => {
          if (!isActiveTurn(sessionId, turnId)) {
            resolve();
            return;
          }

          if (isPlaying()) {
            requestAnimationFrame(poll);
            return;
          }

          settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            resolve();
          }, POST_PLAYBACK_SETTLE_MS);
        };

        poll();
      }),
    [isActiveTurn, isPlaying],
  );

  const finalizePendingAssistantMessage = useCallback(() => {
    const chatState = useChatStore.getState();
    if (chatState.streamingMessageId) {
      finishAssistantMessage(EMPTY_ASSISTANT_METADATA);
    }

    setThinking(false);
  }, [finishAssistantMessage, setThinking]);

  const clearDisplayedTranscripts = useCallback(() => {
    setUserTranscript("");
    setFinalTranscript("");
    setCleoTranscript("");
  }, [setCleoTranscript, setFinalTranscript, setUserTranscript]);

  const clearPlayback = useCallback(
    (reason: "interrupt" | "session_end" | "playback_error" | "prepare") => {
      clearTimers();
      abortRef.current?.abort();
      abortRef.current = null;
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
      stopAudio();
      cancelBrowserTTS();
      useVoiceStore.getState().setAudioLevel(0);
      setCleoTranscript("");
      const { sessionId, turnId } = useVoiceStore.getState();
      logVoiceLifecycle("playback_stopped", {
        reason,
        sessionId,
        turnId,
      });
    },
    [clearTimers, setCleoTranscript, stopAudio],
  );

  const transitionToSessionOpen = useCallback(
    (
      sessionId: number,
      reason: "session_opened" | "speaking_completed" | "empty_turn" | "retry_ready",
    ) => {
      if (!isActiveSession(sessionId)) {
        logStaleEvent("transition_session_open", { sessionId, reason });
        return;
      }

      clearTimers();
      stopSTT();
      clearDisplayedTranscripts();
      setError(null);
      setPhase("session_open");
      useVoiceStore.getState().setAudioLevel(0);

      logVoiceLifecycle(reason, {
        sessionId,
        turnId: useVoiceStore.getState().turnId,
      });
    },
    [
      clearDisplayedTranscripts,
      clearTimers,
      isActiveSession,
      logStaleEvent,
      setError,
      setPhase,
      stopSTT,
    ],
  );

  const startListening = useCallback(
    (
      sessionId: number,
      reason:
        | "session_started"
        | "manual_interrupt"
        | "continue_session"
        | "speaking_completed",
    ) => {
      if (!isActiveSession(sessionId)) {
        logStaleEvent("start_listening", { sessionId, reason });
        return;
      }

      clearTimers();
      resetAudio();
      void resumeAudio();
      clearDisplayedTranscripts();
      setError(null);
      setPhase("listening");
      startSTT();

      const avatarStore = useAvatarStore.getState();
      if (avatarStore.isConnected) {
        avatarStore.setState("listening");
      }

      logVoiceLifecycle("listening_started", {
        sessionId,
        turnId: useVoiceStore.getState().turnId,
        reason,
      });
    },
    [
      clearDisplayedTranscripts,
      clearTimers,
      isActiveSession,
      logStaleEvent,
      resetAudio,
      resumeAudio,
      setError,
      setPhase,
      startSTT,
    ],
  );

  const setSessionError = useCallback(
    (sessionId: number, message: string) => {
      if (!isActiveSession(sessionId)) {
        logStaleEvent("session_error", { sessionId });
        return;
      }

      clearTimers();
      stopSTT();
      stopAudio();
      cancelBrowserTTS();
      useVoiceStore.getState().setAudioLevel(0);
      clearDisplayedTranscripts();
      setThinking(false);
      setError(message);

      logVoiceLifecycle("playback_error", {
        sessionId,
        turnId: useVoiceStore.getState().turnId,
      });
    },
    [
      clearDisplayedTranscripts,
      clearTimers,
      isActiveSession,
      logStaleEvent,
      setError,
      setThinking,
      stopAudio,
      stopSTT,
    ],
  );

  const activate = useCallback(() => {
    const state = useVoiceStore.getState();
    if (!state.isSupported || state.phase === "session_closing") {
      return;
    }

    if (!state.isVoiceMode) {
      const { sessionId } = openSession();

      logVoiceLifecycle("session_opened", {
        sessionId,
      });

      startListening(sessionId, "session_started");
      return;
    }

    if (state.phase === "session_open" || state.phase === "idle") {
      startListening(state.sessionId, "continue_session");
    }
  }, [openSession, startListening]);

  const speakVoiceResponse = useCallback(
    async (
      voiceText: string,
      sessionId: number,
      turnId: number,
    ): Promise<boolean> => {
      const normalizedVoiceText = normalizeVoiceText(voiceText);
      const signal = ttsAbortRef.current?.signal;

      if (!normalizedVoiceText || signal?.aborted || !isActiveTurn(sessionId, turnId)) {
        return false;
      }

      const speakWithBrowserFallback = async () => {
        if (!isActiveTurn(sessionId, turnId) || signal?.aborted) {
          return false;
        }

        setPhase("speaking");
        logVoiceLifecycle("speaking_started", {
          sessionId,
          turnId,
          transport: "browser_tts",
        });
        await speakWithBrowserTTS(normalizedVoiceText);
        return true;
      };

      try {
        const audioBlob = await synthesizeSpeech(normalizedVoiceText, {}, signal);
        if (!isActiveTurn(sessionId, turnId) || signal?.aborted) {
          return false;
        }

        if (audioBlob.size > 0) {
          await enqueueAudio(audioBlob);
          return true;
        }

        return speakWithBrowserFallback();
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return false;
        }

        console.error(
          "[VoiceMode] Backend TTS failed, falling back to browser speech:",
          error,
        );
        return speakWithBrowserFallback();
      }
    },
    [enqueueAudio, isActiveTurn, setPhase],
  );

  const sendVoiceMessage = useCallback(async () => {
    const state = useVoiceStore.getState();
    if (!state.isVoiceMode || state.phase !== "listening") {
      return;
    }

    const { sessionId } = useVoiceStore.getState();
    const turnId = advanceTurn();
    clearTimers();

    const transcript = stopSTT();
    const finalTranscript = transcript || useVoiceStore.getState().userTranscript;

    if (!finalTranscript.trim()) {
      transitionToSessionOpen(sessionId, "empty_turn");
      return;
    }

    setPhase("processing");
    setFinalTranscript(finalTranscript);
    setError(null);
    logVoiceLifecycle("processing_started", { sessionId, turnId });

    const avatarStore = useAvatarStore.getState();
    if (avatarStore.isConnected) {
      avatarStore.setState("listening");
    }

    const chatState = useChatStore.getState();
    const { messages, conversationId } = chatState;
    addUserMessage(finalTranscript);
    setThinking(true);
    setErrorType(null);
    setCleoTranscript("");
    useVoiceStore.getState().setUserTranscript("");

    const history = messages
      .filter((message) => !message.isStreaming)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    ttsAbortRef.current?.abort();
    ttsAbortRef.current = new AbortController();

    const sendTimestamp = performance.now();
    let firstTokenRecorded = false;
    let chatId = chatState.activeChatId;
    let streamPath = CHAT_STREAM_ENDPOINT;
    let body: ChatRequest | { message: string; voice_mode: boolean } = {
      message: finalTranscript,
      conversation_id: conversationId,
      conversation_history: history,
      voice_mode: true,
    };

    try {
      if (isAuthenticated) {
        if (!chatId) {
          const summary = await createPersistedChat();
          if (!isActiveTurn(sessionId, turnId)) {
            logStaleEvent("create_chat_summary", { sessionId, turnId });
            return;
          }
          upsertChatSummary(summary);
          setActiveChat(summary.id, []);
          chatId = summary.id;
        }

        streamPath = `${CHATS_ENDPOINT}/${chatId}/messages/stream`;
        body = { message: finalTranscript, voice_mode: true };
      }

      const response = await api.stream(streamPath, body, controller.signal);
      if (!isActiveTurn(sessionId, turnId)) {
        logStaleEvent("stream_opened", { sessionId, turnId });
        return;
      }

      startAssistantMessage();

      let doneEvent: SSEDoneEvent | null = null;
      let streamError: Error | null = null;
      let preparedVoiceText = "";
      let preparedVoiceQueued = false;
      let preparedVoiceQueuePromise: Promise<void> | null = null;

      await consumeSSEStream(
        response,
        (token: string) => {
          if (!isActiveTurn(sessionId, turnId)) {
            logStaleEvent("token", { sessionId, turnId });
            return;
          }

          if (!firstTokenRecorded) {
            firstTokenRecorded = true;
            const ttft = performance.now() - sendTimestamp;
            useTelemetryStore.getState().recordLatency(ttft);
          }

          appendToken(token);
        },
        (event: SSEDoneEvent) => {
          if (!isActiveTurn(sessionId, turnId)) {
            logStaleEvent("done", { sessionId, turnId });
            return;
          }

          doneEvent = event;

          finishAssistantMessage({
            primary_citations: event.primary_citations || [],
            secondary_citations: event.secondary_citations || [],
            all_citations: event.all_citations || [],
            hidden_sources_count: event.hidden_sources_count || 0,
            mode_used: event.mode_used || "rag",
            max_confidence: event.max_confidence || 0,
            what_i_found: event.what_i_found,
          });

          if (event.chat_summary) {
            upsertChatSummary(event.chat_summary);
          }
        },
        (error: Error) => {
          if (!isActiveTurn(sessionId, turnId)) {
            logStaleEvent("stream_error", { sessionId, turnId });
            return;
          }

          streamError = error;
          finalizePendingAssistantMessage();

          if (error.message.includes("429")) {
            setErrorType("rate-limit");
          } else if (error.message.includes("5")) {
            setErrorType("server");
          } else {
            setErrorType("network");
          }
        },
        (event: SSEVoiceReadyEvent) => {
          if (!isActiveTurn(sessionId, turnId)) {
            logStaleEvent("voice_ready", { sessionId, turnId });
            return;
          }

          const voiceText = normalizeVoiceText(event.voice_response);
          const audioBlob = decodePreparedVoiceAudio(
            event.voice_audio_base64,
            event.voice_audio_content_type,
          );

          preparedVoiceText = voiceText;

          if (audioBlob && audioBlob.size > 0) {
            preparedVoiceQueued = true;
            preparedVoiceQueuePromise = enqueueAudio(audioBlob);
          }
        },
      );

      if (!isActiveTurn(sessionId, turnId)) {
        logStaleEvent("post_stream", { sessionId, turnId });
        return;
      }

      if (streamError) {
        setSessionError(sessionId, "Voice request failed. Please try again.");
        return;
      }

      if (!doneEvent) {
        transitionToSessionOpen(sessionId, "retry_ready");
        return;
      }

      const finalDoneEvent = doneEvent as SSEDoneEvent;
      const voiceText =
        preparedVoiceText || normalizeVoiceText(finalDoneEvent.voice_response ?? "");

      if (preparedVoiceQueuePromise) {
        await preparedVoiceQueuePromise;
      }

      if (!voiceText) {
        setSessionError(
          sessionId,
          "Voice playback unavailable. The written answer is still visible.",
        );
        return;
      }

      let playbackStarted = preparedVoiceQueued;
      if (!preparedVoiceQueued) {
        playbackStarted = await speakVoiceResponse(voiceText, sessionId, turnId);
      }

      if (!isActiveTurn(sessionId, turnId)) {
        logStaleEvent("post_playback_start", { sessionId, turnId });
        return;
      }

      if (!playbackStarted) {
        setSessionError(
          sessionId,
          "Voice playback unavailable. The written answer is still visible.",
        );
        return;
      }

      await waitForPlaybackToSettle(sessionId, turnId);

      if (isActiveTurn(sessionId, turnId)) {
        logVoiceLifecycle("speaking_completed", { sessionId, turnId });
        startListening(sessionId, "speaking_completed");
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }

      if (isActiveSession(sessionId)) {
        finalizePendingAssistantMessage();
        setSessionError(sessionId, "Failed to send voice message. Please try again.");
      }
    }
  }, [
    addUserMessage,
    appendToken,
    clearTimers,
    enqueueAudio,
    finalizePendingAssistantMessage,
    finishAssistantMessage,
    isActiveSession,
    isActiveTurn,
    isAuthenticated,
    logStaleEvent,
    setActiveChat,
    setCleoTranscript,
    setError,
    setErrorType,
    setFinalTranscript,
    setPhase,
    setSessionError,
    setThinking,
    speakVoiceResponse,
    startAssistantMessage,
    stopSTT,
    startListening,
    transitionToSessionOpen,
    upsertChatSummary,
    waitForPlaybackToSettle,
  ]);

  const interruptCurrentTurn = useCallback(() => {
    const state = useVoiceStore.getState();
    if (!state.isVoiceMode || state.phase !== "speaking") {
      return;
    }

    const { sessionId, turnId: interruptedTurnId } = useVoiceStore.getState();
    const nextTurnId = advanceTurn();

    logVoiceLifecycle("interrupt_triggered", {
      sessionId,
      interruptedTurnId,
      nextTurnId,
    });

    clearPlayback("interrupt");
    finalizePendingAssistantMessage();
    if (!isActiveSession(sessionId)) {
      logStaleEvent("interrupt_after_cleanup", { sessionId });
      return;
    }

    startListening(sessionId, "manual_interrupt");
  }, [
    clearPlayback,
    finalizePendingAssistantMessage,
    isActiveSession,
    logStaleEvent,
    startListening,
  ]);

  const deactivate = useCallback(() => {
    const state = useVoiceStore.getState();
    if (!state.isVoiceMode) {
      return;
    }

    const { previousSessionId, nextSessionId } = invalidateSession();
    setPhase("session_closing");

    logVoiceLifecycle("session_ended", {
      sessionId: previousSessionId,
      nextSessionId,
    });

    finalizePendingAssistantMessage();
    clearPlayback("session_end");
    stopSTT();
    clearDisplayedTranscripts();
    setError(null);
    stopVoiceMode();
  }, [
    clearDisplayedTranscripts,
    clearPlayback,
    finalizePendingAssistantMessage,
    setError,
    setPhase,
    stopSTT,
    stopVoiceMode,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key === "V") {
        event.preventDefault();
        const state = useVoiceStore.getState();
        if (!state.isSupported) {
          return;
        }

        if (state.isVoiceMode) {
          deactivate();
        } else {
          activate();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activate, deactivate]);

  useEffect(() => {
    const trimmedTranscript = userTranscript.trim();
    if (!isVoiceMode || phase !== "listening" || trimmedTranscript.length < 3) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      void sendVoiceMessage();
      silenceTimerRef.current = null;
    }, 2800);

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [isVoiceMode, phase, sendVoiceMessage, userTranscript]);

  return {
    activate,
    sendVoiceMessage,
    interruptCurrentTurn,
    deactivate,
  };
}
