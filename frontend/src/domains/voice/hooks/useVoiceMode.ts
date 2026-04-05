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
import { useBargeInMonitor } from "./useBargeInMonitor";
import { useSpokenInterruptMonitor } from "./useSpokenInterruptMonitor";
import {
  cancelBrowserTTS,
  synthesizeSpeech,
  speakWithBrowserTTS,
} from "@/domains/voice/engine";
import { api, consumeSSEStream } from "@/lib/api";
import { CHATS_ENDPOINT, CHAT_STREAM_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, SSEDoneEvent, SSEVoiceReadyEvent } from "@/types";
import { stripMarkdown } from "@/lib/utils/markdown";

const POST_PLAYBACK_SETTLE_MS = 800;
const VOICE_FALLBACK_WORD_LIMIT = 75;

function normalizeVoiceText(text: string): string {
  return stripMarkdown(text).replace(/\s+/g, " ").trim();
}

function clampVoiceFallback(text: string): string {
  const normalized = normalizeVoiceText(text);
  if (!normalized) {
    return "";
  }

  const words = normalized.split(" ");
  if (words.length <= VOICE_FALLBACK_WORD_LIMIT) {
    return normalized;
  }

  const truncated = words.slice(0, VOICE_FALLBACK_WORD_LIMIT).join(" ").trim();
  return truncated && !/[.!?]$/.test(truncated) ? `${truncated}.` : truncated;
}

function splitVoiceResponse(text: string): string[] {
  const normalized = normalizeVoiceText(text);
  if (!normalized) {
    return [];
  }

  const sentences = normalized
    .match(/[^.!?]+[.!?]?/g)
    ?.map((chunk) => chunk.trim())
    .filter(Boolean);

  return sentences && sentences.length > 0 ? sentences : [normalized];
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

/**
 * useVoiceMode — master orchestrator for the voice-to-voice pipeline.
 *
 * Lifecycle:
 *   1. User clicks mic → startVoiceMode() → STT starts listening
 *   2. User speaks → interim transcripts shown in real-time
 *   3. User clicks stop (or silence timeout) → sendVoiceMessage()
 *      → final transcript → send to chat stream endpoint with voice_mode=true
 *   4. SSE tokens stream back → text chat updates normally
 *   5. voice_ready returns prepared audio + short spoken text → playback starts
 *   6. done finalizes chat metadata while the full answer is already visible
 *   7. Playback drains → STT reopens for the next turn
 */
export function useVoiceMode() {
  const { start: startSTT, stop: stopSTT } = useSpeechRecognition();
  const setPhase = useVoiceStore((s) => s.setPhase);
  const { enqueueAudio, stopAudio, resetAudio, resumeAudio, isPlaying } =
    useAudioAnalyser({
      onChunkStart: () => {
        const state = useVoiceStore.getState();
        if (state.isVoiceMode && state.phase !== "speaking") {
          setPhase("speaking");
        }
      },
    });

  const startVoiceMode = useVoiceStore((s) => s.startVoiceMode);
  const stopVoiceMode = useVoiceStore((s) => s.stopVoiceMode);
  const setError = useVoiceStore((s) => s.setError);
  const setCleoTranscript = useVoiceStore((s) => s.setCleoTranscript);
  const setFinalTranscript = useVoiceStore((s) => s.setFinalTranscript);
  const setUserTranscript = useVoiceStore((s) => s.setUserTranscript);

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
  const speechDetectedAtRef = useRef(0);
  const spokenVoiceTextRef = useRef("");
  const turnRef = useRef(0);
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

  const getSpokenVoiceText = useCallback(() => spokenVoiceTextRef.current, []);
  const getSpeechDetectedAt = useCallback(() => speechDetectedAtRef.current, []);

  const waitForPlaybackToSettle = useCallback(
    async (turnId: number) =>
      new Promise<void>((resolve) => {
        const poll = () => {
          if (turnId !== turnRef.current) {
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
    [isPlaying],
  );

  const maybeResumeListening = useCallback((seedTranscript?: string) => {
    const state = useVoiceStore.getState();
    if (!state.isVoiceMode) {
      setPhase("idle");
      return;
    }

    const nextTranscript = seedTranscript?.trim() ?? "";
    if (nextTranscript) {
      setUserTranscript(nextTranscript);
      setFinalTranscript(nextTranscript);
    } else {
      setUserTranscript("");
      setFinalTranscript("");
    }

    setPhase("listening");
    startSTT({ seedTranscript });
  }, [setFinalTranscript, setPhase, setUserTranscript, startSTT]);

  const activate = useCallback(() => {
    turnRef.current += 1;
    clearTimers();
    startVoiceMode();
    resetAudio();
    void resumeAudio();
    setCleoTranscript("");
    spokenVoiceTextRef.current = "";
    speechDetectedAtRef.current = 0;
    useVoiceStore.getState().setUserTranscript("");
    setFinalTranscript("");
    startSTT();
  }, [
    clearTimers,
    resetAudio,
    resumeAudio,
    setCleoTranscript,
    setFinalTranscript,
    startSTT,
    startVoiceMode,
  ]);

  const interruptCurrentTurn = useCallback(async (seedTranscript?: string) => {
    const state = useVoiceStore.getState();
    if (!state.isVoiceMode) {
      return;
    }

    turnRef.current += 1;
    clearTimers();
    abortRef.current?.abort();
    ttsAbortRef.current?.abort();
    stopSTT();
    stopAudio();
    cancelBrowserTTS();
    spokenVoiceTextRef.current = "";
    useVoiceStore.getState().setAudioLevel(0);

    const avatarInterrupt = useAvatarStore.getState().interruptFn;
    if (avatarInterrupt) {
      try {
        await avatarInterrupt();
      } catch (error) {
        console.error("[VoiceMode] Avatar interrupt failed:", error);
      }
    }

    if (useVoiceStore.getState().isVoiceMode) {
      maybeResumeListening(seedTranscript);
    }
  }, [clearTimers, maybeResumeListening, stopAudio, stopSTT]);

  useBargeInMonitor({
    active: isVoiceMode,
    speaking: phase === "speaking",
    onSpeechDetected: () => {
      speechDetectedAtRef.current = performance.now();
    },
  });

  useSpokenInterruptMonitor({
    active: isVoiceMode,
    speaking: phase === "speaking",
    getSpokenText: getSpokenVoiceText,
    getSpeechDetectedAt,
    onInterruptIntent: (seedTranscript) => {
      void interruptCurrentTurn(seedTranscript);
    },
  });

  const speakVoiceResponse = useCallback(
    async (voiceText: string, turnId: number) => {
      const sentences = splitVoiceResponse(voiceText);
      if (sentences.length === 0) {
        return;
      }

      for (const sentence of sentences) {
        const signal = ttsAbortRef.current?.signal;
        if (!sentence || signal?.aborted || turnId !== turnRef.current) {
          return;
        }

        try {
          const audioBlob = await synthesizeSpeech(sentence, {}, signal);
          if (signal?.aborted || turnId !== turnRef.current) {
            return;
          }

          if (audioBlob.size === 0) {
            const isFallbackEnabled =
              process.env.NEXT_PUBLIC_ENABLE_TTS_FALLBACK !== "false";
            if (isFallbackEnabled) {
              setPhase("speaking");
              await speakWithBrowserTTS(sentence);
            }
          } else {
            enqueueAudio(audioBlob);
          }
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            return;
          }
          console.error("[VoiceMode] TTS synthesis failed:", error);
        }
      }
    },
    [enqueueAudio, setPhase],
  );

  const sendVoiceMessage = useCallback(async () => {
    const turnId = ++turnRef.current;
    clearTimers();

    const transcript = stopSTT();
    const finalTranscript = transcript || useVoiceStore.getState().userTranscript;

    if (!finalTranscript.trim()) {
      stopVoiceMode();
      return;
    }

    setPhase("processing");
    setFinalTranscript(finalTranscript);

    const avatarStore = useAvatarStore.getState();
    if (avatarStore.isConnected) {
      avatarStore.setState("listening");
    }

    const state = useChatStore.getState();
    const { messages, conversationId } = state;
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
    let chatId = state.activeChatId;
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
          upsertChatSummary(summary);
          setActiveChat(summary.id, []);
          chatId = summary.id;
        }

        streamPath = `${CHATS_ENDPOINT}/${chatId}/messages/stream`;
        body = { message: finalTranscript, voice_mode: true };
      }

      const response = await api.stream(streamPath, body, controller.signal);

      startAssistantMessage();

      let doneEvent: SSEDoneEvent | null = null;
      let streamError: Error | null = null;
      let preparedVoiceText = "";
      let preparedVoiceQueued = false;

      await consumeSSEStream(
        response,
        (token: string) => {
          if (!firstTokenRecorded) {
            firstTokenRecorded = true;
            const ttft = performance.now() - sendTimestamp;
            useTelemetryStore.getState().recordLatency(ttft);
          }

          appendToken(token);
        },
        (event: SSEDoneEvent) => {
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
          streamError = error;

          finishAssistantMessage({
            primary_citations: [],
            secondary_citations: [],
            all_citations: [],
            hidden_sources_count: 0,
            mode_used: "rag",
            max_confidence: 0,
          });

          if (error.message.includes("429")) {
            setErrorType("rate-limit");
          } else if (error.message.includes("5")) {
            setErrorType("server");
          } else {
            setErrorType("network");
          }

          setPhase("idle");
        },
        (event: SSEVoiceReadyEvent) => {
          const voiceText = normalizeVoiceText(event.voice_response);
          const audioBlob = decodePreparedVoiceAudio(
            event.voice_audio_base64,
            event.voice_audio_content_type,
          );

          preparedVoiceText = voiceText;
          spokenVoiceTextRef.current = voiceText;

          if (audioBlob && audioBlob.size > 0) {
            preparedVoiceQueued = true;
            enqueueAudio(audioBlob);
          }
        },
      );

      if (streamError || turnId !== turnRef.current || !doneEvent) {
        return;
      }

      const finalDoneEvent = doneEvent as SSEDoneEvent;
      const voiceText =
        preparedVoiceText ||
        normalizeVoiceText(finalDoneEvent.voice_response ?? "") ||
        clampVoiceFallback(
          useChatStore.getState().messages.slice(-1)[0]?.content ?? "",
        );

      if (!preparedVoiceQueued && voiceText) {
        spokenVoiceTextRef.current = voiceText;
        await speakVoiceResponse(voiceText, turnId);
      }

      if (preparedVoiceQueued || voiceText) {
        await waitForPlaybackToSettle(turnId);
      }

      if (turnId === turnRef.current) {
        spokenVoiceTextRef.current = "";
        useVoiceStore.getState().setAudioLevel(0);
        maybeResumeListening();
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }

      setThinking(false);
      setError("Failed to send voice message. Please try again.");
      setPhase("idle");
    }
  }, [
    addUserMessage,
    appendToken,
    clearTimers,
    finishAssistantMessage,
    isAuthenticated,
    maybeResumeListening,
    setActiveChat,
    setCleoTranscript,
    setError,
    setErrorType,
    setFinalTranscript,
    setPhase,
    setThinking,
    speakVoiceResponse,
    startAssistantMessage,
    stopSTT,
    stopVoiceMode,
    upsertChatSummary,
    waitForPlaybackToSettle,
  ]);

  const deactivate = useCallback(() => {
    turnRef.current += 1;
    clearTimers();
    stopSTT();
    stopAudio();
    abortRef.current?.abort();
    ttsAbortRef.current?.abort();
    cancelBrowserTTS();
    spokenVoiceTextRef.current = "";
    stopVoiceMode();
  }, [clearTimers, stopAudio, stopSTT, stopVoiceMode]);

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
  }, [isVoiceMode, phase, userTranscript, sendVoiceMessage]);

  return {
    activate,
    interruptCurrentTurn,
    sendVoiceMessage,
    deactivate,
  };
}
