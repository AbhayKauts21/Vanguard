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
import { SentenceChunker, synthesizeSpeech } from "@/domains/voice/engine";
import { api, consumeSSEStream } from "@/lib/api";
import { CHATS_ENDPOINT, CHAT_STREAM_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, SSEDoneEvent } from "@/types";
import { stripMarkdown } from "@/lib/utils/markdown";

/**
 * Orchestrates the voice-to-voice conversation pipeline.
 */
export function useVoiceMode() {
  const { start: startSTT, stop: stopSTT } = useSpeechRecognition();
  const { enqueueAudio, stopAudio, resetAudio, clearPending, resumeAudio, isPlaying } = useAudioAnalyser(
    useCallback((index: number) => {
      currentChunkIndexRef.current.val = index;
    }, [])
  );

  const startVoiceMode = useVoiceStore((s) => s.startVoiceMode);
  const stopVoiceMode = useVoiceStore((s) => s.stopVoiceMode);
  const setPhase = useVoiceStore((s) => s.setPhase);
  const setError = useVoiceStore((s) => s.setError);
  const appendCleoTranscript = useVoiceStore((s) => s.appendCleoTranscript);
  const setCleoTranscript = useVoiceStore((s) => s.setCleoTranscript);

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
  const chunkerRef = useRef<SentenceChunker | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const emittedSentencesRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef<{ val: number }>({ val: -1 });
  const lastInterruptedContextRef = useRef<string | null>(null);
  const vibeRef = useRef<string>("professional");

  const phase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const currentVibe = useVoiceStore((s) => s.vibe);

  /**
   * Start STT and reset audio state.
   */
  const activate = useCallback(() => {
    startVoiceMode();
    resetAudio();
    resumeAudio(); 
    setCleoTranscript("");
    emittedSentencesRef.current = [];
    // eslint-disable-next-line react-hooks/immutability
    currentChunkIndexRef.current.val = -1;
    vibeRef.current = useVoiceStore.getState().vibe;
    useVoiceStore.getState().setUserTranscript(""); 
    
    startSTT(() => {
      const { phase } = useVoiceStore.getState();
      if (phase === "speaking") {
        const idx = currentChunkIndexRef.current.val;
        if (idx >= 0) {
          lastInterruptedContextRef.current = emittedSentencesRef.current
            .slice(0, idx + 1)
            .join(" ");
        }

        stopAudio();
        resetAudio();
        ttsAbortRef.current?.abort();
        ttsAbortRef.current = new AbortController();
      }
    });
  }, [startVoiceMode, resetAudio, resumeAudio, setCleoTranscript, startSTT, stopAudio]);

  /**
   * Finalize user message and trigger response stream.
   */
  const sendVoiceMessage = useCallback(async () => {
    const transcript = stopSTT();
    const finalTranscript = transcript || useVoiceStore.getState().userTranscript;

    if (useVoiceStore.getState().isMuted) {
      stopVoiceMode();
      return;
    }

    if (!finalTranscript.trim()) {
      stopVoiceMode();
      return;
    }

    setPhase("processing");

    const avatarStore = useAvatarStore.getState();
    if (avatarStore.isConnected) avatarStore.setState("listening");

    const chatState = useChatStore.getState();
    addUserMessage(finalTranscript);
    setThinking(true);
    setErrorType(null);
    setCleoTranscript("");
    useVoiceStore.getState().setUserTranscript("");

    const history = chatState.messages
      .filter((m) => !m.isStreaming)
      .slice(-10)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    ttsAbortRef.current?.abort();
    ttsAbortRef.current = new AbortController();

    const sendTimestamp = performance.now();
    let firstTokenRecorded = false;
    let chatId = chatState.activeChatId;
    let streamPath = CHAT_STREAM_ENDPOINT;
    
    vibeRef.current = useVoiceStore.getState().vibe;
    emittedSentencesRef.current = [];
    // eslint-disable-next-line react-hooks/immutability
    currentChunkIndexRef.current.val = -1;

    const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const location = Intl.DateTimeFormat().resolvedOptions().timeZone.replace('_', ' ');

    let body: ChatRequest = {
      message: finalTranscript,
      conversation_id: chatState.conversationId,
      conversation_history: history,
      is_voice_mode: true,
      vibe: vibeRef.current,
      local_time: localTime,
      location: location,
      interrupted_context: lastInterruptedContextRef.current || undefined,
    };

    lastInterruptedContextRef.current = null;
    stopSTT(); // Stop microphone explicitly while processing

    chunkerRef.current = new SentenceChunker(async (sentence: string) => {
      emittedSentencesRef.current.push(sentence);
      appendCleoTranscript(sentence);

      try {
        const speechText = stripMarkdown(sentence);
        if (!speechText) return;

        const audioBlob = await synthesizeSpeech(
          speechText,
          { sentiment: vibeRef.current },
          ttsAbortRef.current?.signal,
        );
        
        if (audioBlob.size > 0) enqueueAudio(audioBlob);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error("TTS failed:", err);
      }
    });

    try {
      if (isAuthenticated) {
        if (!chatId) {
          const summary = await createPersistedChat();
          upsertChatSummary(summary);
          setActiveChat(summary.id, []);
          chatId = summary.id;
        }
        streamPath = `${CHATS_ENDPOINT}/${chatId}/messages/stream`;
        body = { ...body }; // Context preserved
      }

      const response = await api.stream(streamPath, body, abortRef.current.signal);
      startAssistantMessage();
      setPhase("speaking");

      await consumeSSEStream(
        response,
        (token) => {
          if (!firstTokenRecorded) {
            firstTokenRecorded = true;
            useTelemetryStore.getState().recordLatency(performance.now() - sendTimestamp);
          }
          appendToken(token);
          chunkerRef.current?.feed(token);
        },
        (event) => {
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

          if (event.chat_summary) upsertChatSummary(event.chat_summary);

          const waitForAudio = () => {
            if (isPlaying()) {
              requestAnimationFrame(waitForAudio);
            } else {
              setTimeout(() => {
                if (useVoiceStore.getState().isVoiceMode) {
                  setPhase("listening");
                  startSTT(() => {
                    if (useVoiceStore.getState().phase === "speaking") {
                      stopAudio();
                      resetAudio();
                      ttsAbortRef.current?.abort();
                      ttsAbortRef.current = new AbortController();
                    }
                  });
                } else {
                  setPhase("idle");
                }
                useVoiceStore.getState().setAudioLevel(0);
              }, 800);
            }
          };
          setTimeout(waitForAudio, 500);
        },
        (err) => {
          chunkerRef.current?.flush();
          finishAssistantMessage({
            primary_citations: [],
            secondary_citations: [],
            all_citations: [],
            hidden_sources_count: 0,
            mode_used: "rag",
            max_confidence: 0
          });
          setErrorType(err.message.includes("429") ? "rate-limit" : "network");
          setPhase("idle");
        },
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Request failed.");
        setPhase("idle");
      }
    }
  }, [stopSTT, stopVoiceMode, setPhase, addUserMessage, setThinking, setErrorType, setCleoTranscript, appendCleoTranscript, startAssistantMessage, appendToken, finishAssistantMessage, setActiveChat, enqueueAudio, isAuthenticated, isPlaying, setError, upsertChatSummary, startSTT, stopAudio, resetAudio]);

  /**
   * Interrupt CLEO's speech manually.
   */
  const interrupt = useCallback(() => {
    if (useVoiceStore.getState().phase !== "speaking") return;

    // 1. Capture context
    const idx = currentChunkIndexRef.current.val;
    if (idx >= 0) {
      lastInterruptedContextRef.current = emittedSentencesRef.current
        .slice(0, idx + 1)
        .join(" ");
    }

    // 2. Stop audio and streams
    stopAudio();
    resetAudio();
    abortRef.current?.abort();
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = new AbortController();
    chunkerRef.current?.reset();

    // 3. Transition to listening
    setPhase("listening");
    startSTT();
  }, [stopAudio, resetAudio, setPhase, startSTT]);

  /**
   * Reset everything to idle.
   */
  const deactivate = useCallback(() => {
    stopSTT();
    stopAudio();
    abortRef.current?.abort();
    ttsAbortRef.current?.abort();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    chunkerRef.current?.reset();
    stopVoiceMode();
  }, [stopSTT, stopAudio, stopVoiceMode]);

  /**
   * Ctrl+Shift+V toggle.
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "V") {
        const { isVoiceMode, isSupported } = useVoiceStore.getState();
        if (!isSupported) return;
        isVoiceMode ? deactivate() : activate();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activate, deactivate]);

  /**
   * Auto-send on silence (2.8s).
   */
  useEffect(() => {
    const trimmed = userTranscript.trim();
    if (!isVoiceMode || phase !== "listening" || trimmed.length < 3) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(sendVoiceMessage, 2800);
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [isVoiceMode, phase, userTranscript, sendVoiceMessage]);

  /**
   * Hot-swap sentiment during speech.
   */
  useEffect(() => {
    if (phase === "speaking" && currentVibe !== vibeRef.current) {
      vibeRef.current = currentVibe;
      clearPending();
      const pendingIndices = emittedSentencesRef.current
        .map((_, i) => i)
        .filter(i => i > currentChunkIndexRef.current.val);

      if (pendingIndices.length > 0) {
        ttsAbortRef.current?.abort();
        ttsAbortRef.current = new AbortController();
        pendingIndices.forEach(async (index) => {
          const sentence = emittedSentencesRef.current[index];
          const speechText = stripMarkdown(sentence);
          if (!speechText) return;
          try {
            const audioBlob = await synthesizeSpeech(speechText, { sentiment: currentVibe }, ttsAbortRef.current?.signal);
            if (audioBlob.size > 0) enqueueAudio(audioBlob);
          } catch (err) {
            if ((err as Error).name !== "AbortError") console.error("Hot-swap failed:", err);
          }
        });
      }
    } else if (phase !== "speaking") {
      vibeRef.current = currentVibe;
    }
  }, [currentVibe, phase, clearPending, enqueueAudio]);

  return { activate, sendVoiceMessage, deactivate, interrupt };
}
