"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/domains/chat/model";
import { useAuthStore } from "@/domains/auth/model";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";
import { api, consumeSSEStream } from "@/lib/api";
import { createPersistedChat } from "@/domains/chat/api";
import { CHATS_ENDPOINT, CHAT_STREAM_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, SSEDoneEvent } from "@/types";

/* Hook for streaming chat via SSE with token-by-token rendering. */
export function useChatStream() {
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

  const sendStream = useCallback(
    async (message: string) => {
      const state = useChatStore.getState();
      const { messages, conversationId } = state;
      const history = messages
        .filter(m => !m.isStreaming) // Don't send partial states
        .slice(-10)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      /* Cancel any in-flight stream. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let chatId = state.activeChatId;
      let streamPath = CHAT_STREAM_ENDPOINT;
      let body: ChatRequest | { message: string } = {
        message,
        conversation_id: conversationId,
        conversation_history: history,
      };

      if (isAuthenticated) {
        if (!chatId) {
          const summary = await createPersistedChat();
          upsertChatSummary(summary);
          setActiveChat(summary.id, []);
          chatId = summary.id;
        }

        streamPath = `${CHATS_ENDPOINT}/${chatId}/messages/stream`;
        body = { message };
      }

      addUserMessage(message);
      setThinking(true);
      setErrorType(null);

      // Transition avatar to "listening" while waiting for the streamed answer
      const avatarStore = useAvatarStore.getState();
      if (avatarStore.isConnected) {
        useAvatarStore.getState().setState("listening");
      }

      /* Phase 8: record time-to-first-token latency */
      const sendTimestamp = performance.now();
      let firstTokenRecorded = false;

      try {
        const response = await api.stream(streamPath, body, controller.signal);

        startAssistantMessage();

        await consumeSSEStream(
          response,
          /* onToken */
          (token: string) => {
            /* Measure TTFT on the very first token */
            if (!firstTokenRecorded) {
              firstTokenRecorded = true;
              const ttft = performance.now() - sendTimestamp;
              useTelemetryStore.getState().recordLatency(ttft);
            }
            appendToken(token);
          },
          /* onDone */
          (event: SSEDoneEvent) => {
            finishAssistantMessage({
              primary_citations: event.primary_citations || [],
              secondary_citations: event.secondary_citations || [],
              all_citations: event.all_citations || [],
              hidden_sources_count: event.hidden_sources_count || 0,
              mode_used: event.mode_used || "rag",
              max_confidence: event.max_confidence || 0,
              what_i_found: event.what_i_found
            });

            if (event.chat_summary) {
              upsertChatSummary(event.chat_summary);
            }

            // Trigger the HeyGen avatar speech once the text pipeline unloads
            const store = useAvatarStore.getState();
            if (store.isConnected && store.speakFn) {
              const fullAnswer = useChatStore.getState().messages.slice(-1)[0]?.content;
              if (fullAnswer) {
                store.speakFn(fullAnswer);
              }
            }
          },
          /* onError */
          (err: Error) => {
            finishAssistantMessage({
              primary_citations: [],
              secondary_citations: [],
              all_citations: [],
              hidden_sources_count: 0,
              mode_used: "rag",
              max_confidence: 0
            });
            if (err.message.includes("429")) {
              setErrorType("rate-limit");
            } else if (err.message.includes("5")) { // 500, 502, 503, 504
              setErrorType("server");
            } else {
              setErrorType("network");
            }
          },
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setThinking(false);
        if ((err as Error).message.includes("429")) {
          setErrorType("rate-limit");
        } else {
          setErrorType("network");
        }
      }
    },
    [
      addUserMessage,
      isAuthenticated,
      setThinking,
      startAssistantMessage,
      appendToken,
      finishAssistantMessage,
      setActiveChat,
      setErrorType,
      upsertChatSummary,
    ],
  );

  /* Cancel in-flight stream. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { sendStream, cancel };
}
