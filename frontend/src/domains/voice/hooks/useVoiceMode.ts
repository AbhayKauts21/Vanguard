"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVoiceStore } from "@/domains/voice/model";
import { useChatStore } from "@/domains/chat/model";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAudioAnalyser } from "./useAudioAnalyser";
import { SentenceChunker, synthesizeSpeech } from "@/domains/voice/engine";
import { api, consumeSSEStream } from "@/lib/api";
import { CHAT_STREAM_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, SSEDoneEvent } from "@/types";

/**
 * useVoiceMode — master orchestrator for the voice-to-voice pipeline.
 *
 * Lifecycle:
 *   1. User clicks mic → startVoiceMode() → STT starts listening
 *   2. User speaks → interim transcripts shown in real-time
 *   3. User clicks stop (or silence timeout) → stopListening()
 *      → final transcript → send to chat stream endpoint
 *   4. SSE tokens stream back → sentence chunker → TTS per sentence
 *      → audio queue → playback with avatar sync
 *   5. All audio finishes → return to idle
 *
 * Coordinates: VoiceStore, ChatStore, AvatarStore, STT engine, TTS engine,
 *              SentenceChunker, AudioQueue.
 */
export function useVoiceMode() {
  const { start: startSTT, stop: stopSTT } = useSpeechRecognition();
  const { enqueueAudio, stopAudio, resetAudio, isPlaying } = useAudioAnalyser();

  // Voice store actions
  const startVoiceMode = useVoiceStore((s) => s.startVoiceMode);
  const stopVoiceMode = useVoiceStore((s) => s.stopVoiceMode);
  const setPhase = useVoiceStore((s) => s.setPhase);
  const setError = useVoiceStore((s) => s.setError);
  const appendCleoTranscript = useVoiceStore((s) => s.appendCleoTranscript);
  const setCleoTranscript = useVoiceStore((s) => s.setCleoTranscript);

  // Chat store actions
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendToken = useChatStore((s) => s.appendToken);
  const finishAssistantMessage = useChatStore((s) => s.finishAssistantMessage);
  const setErrorType = useChatStore((s) => s.setErrorType);

  const abortRef = useRef<AbortController | null>(null);
  const chunkerRef = useRef<SentenceChunker | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const phase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);

  /**
   * Enter voice mode — start STT listening.
   */
  const activate = useCallback(() => {
    startVoiceMode();
    resetAudio();
    setCleoTranscript("");
    useVoiceStore.getState().setUserTranscript(""); // Clear user transcript on fresh activation
    startSTT();
  }, [startVoiceMode, resetAudio, setCleoTranscript, startSTT]);

  /**
   * Stop listening and send the captured transcript to the chat pipeline.
   * This triggers the full processing → TTS → playback flow.
   */
  const sendVoiceMessage = useCallback(async () => {
    // Stop STT and get final transcript
    const transcript = stopSTT();
    const finalTranscript = transcript || useVoiceStore.getState().userTranscript;

    if (!finalTranscript.trim()) {
      // Nothing was captured — go back to idle
      stopVoiceMode();
      return;
    }

    // Transition to processing
    setPhase("processing");

    // Update avatar to syncing state
    const avatarStore = useAvatarStore.getState();
    if (avatarStore.isConnected) {
      avatarStore.setState("listening");
    }

    // Add user message to chat (also visible in text mode)
    const { messages, conversationId } = useChatStore.getState();
    addUserMessage(finalTranscript);
    setThinking(true);
    setErrorType(null);
    setCleoTranscript("");
    useVoiceStore.getState().setUserTranscript(""); // Clear it after sending to prevent auto-re-trigger

    // Prepare conversation history
    const history = messages
      .filter((m) => !m.isStreaming)
      .slice(-10)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    // Cancel any in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // TTS abort controller
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = new AbortController();

    // TTFT measurement
    const sendTimestamp = performance.now();
    let firstTokenRecorded = false;

    // Sentence chunker → TTS per sentence
    chunkerRef.current = new SentenceChunker(async (sentence: string) => {
      // Queue TTS for this sentence
      appendCleoTranscript(sentence);

      try {
        console.log("[VoiceMode] Synthesizing sentence:", sentence);
        const audioBlob = await synthesizeSpeech(
          sentence,
          {},
          ttsAbortRef.current?.signal,
        );
        console.log("[VoiceMode] Audio synthesized successfully:", audioBlob.size, "bytes");
        enqueueAudio(audioBlob);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[VoiceMode] TTS synthesis failed:", err);
        // Continue without audio — text still shows
      }
    });

    try {
      const body: ChatRequest = {
        message: finalTranscript,
        conversation_id: conversationId,
        conversation_history: history,
      };

      const response = await api.stream(
        CHAT_STREAM_ENDPOINT,
        body,
        controller.signal,
      );

      startAssistantMessage();
      setPhase("speaking");

      await consumeSSEStream(
        response,
        /* onToken */
        (token: string) => {
          if (!firstTokenRecorded) {
            firstTokenRecorded = true;
            const ttft = performance.now() - sendTimestamp;
            useTelemetryStore.getState().recordLatency(ttft);
          }

          appendToken(token);
          chunkerRef.current?.feed(token);
        },
        /* onDone */
        (event: SSEDoneEvent) => {
          // Flush remaining text to TTS
          chunkerRef.current?.flush();

          finishAssistantMessage({
            primary_citations: event.primary_citations || [],
            secondary_citations: event.secondary_citations || [],
            all_citations: event.all_citations || [],
            hidden_sources_count: event.hidden_sources_count || 0,
            mode_used: event.mode_used || "rag",
            max_confidence: event.max_confidence || 0,
            what_i_found: event.what_i_found,
          });

          // Wait for audio queue to drain, then return to listening for to-and-fro conversation
          const waitForAudio = () => {
            if (isPlaying()) {
              requestAnimationFrame(waitForAudio);
            } else {
              const { isVoiceMode } = useVoiceStore.getState();
              if (isVoiceMode) {
                // Auto-restart listening for the next turn
                setPhase("listening");
                startSTT();
              } else {
                setPhase("idle");
              }
              useVoiceStore.getState().setAudioLevel(0);
            }
          };
          // Small delay to let last audio chunk enqueue
          setTimeout(waitForAudio, 500);
        },
        /* onError */
        (err: Error) => {
          chunkerRef.current?.flush();

          finishAssistantMessage({
            primary_citations: [],
            secondary_citations: [],
            all_citations: [],
            hidden_sources_count: 0,
            mode_used: "rag",
            max_confidence: 0,
          });

          if (err.message.includes("429")) {
            setErrorType("rate-limit");
          } else if (err.message.includes("5")) {
            setErrorType("server");
          } else {
            setErrorType("network");
          }

          setPhase("idle");
        },
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setThinking(false);
      setError("Failed to send voice message. Please try again.");
      setPhase("idle");
    }
  }, [
    stopSTT,
    stopVoiceMode,
    setPhase,
    addUserMessage,
    setThinking,
    setErrorType,
    setCleoTranscript,
    appendCleoTranscript,
    startAssistantMessage,
    appendToken,
    finishAssistantMessage,
    enqueueAudio,
    isPlaying,
    setError,
  ]);

  /**
   * Deactivate voice mode — cancel everything and reset.
   */
  const deactivate = useCallback(() => {
    stopSTT();
    stopAudio();
    abortRef.current?.abort();
    ttsAbortRef.current?.abort();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    chunkerRef.current?.reset();
    stopVoiceMode();
  }, [stopSTT, stopAudio, stopVoiceMode]);

  /**
   * Keyboard shortcut: Ctrl+Shift+V toggles voice mode.
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        e.preventDefault();
        const { isVoiceMode, isSupported } = useVoiceStore.getState();
        if (!isSupported) return;

        if (isVoiceMode) {
          deactivate();
        } else {
          activate();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activate, deactivate]);

  /**
   * Silence detection — automatically send message after user stops speaking.
   */
  useEffect(() => {
    // Only monitor silence during the listening phase and for non-empty transcript
    // Minimum length check (3 chars) to avoid triggering on ambient noise/breathing
    const trimmed = userTranscript.trim();
    if (!isVoiceMode || phase !== "listening" || trimmed.length < 3) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    // Reset silence timer on every new transcript result
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    console.log("[VoiceMode] Resetting silence timer...");
    silenceTimerRef.current = setTimeout(() => {
      console.log("[VoiceMode] Silence detected, automatically sending message...");
      sendVoiceMessage();
      silenceTimerRef.current = null;
    }, 2800); // 2.8 seconds of silence

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [isVoiceMode, phase, userTranscript, sendVoiceMessage]);

  return {
    /** Enter voice mode (start listening). */
    activate,
    /** Stop listening and process the voice input. */
    sendVoiceMessage,
    /** Cancel voice mode entirely. */
    deactivate,
  };
}
