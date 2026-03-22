"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/domains/chat/model";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { api, consumeSSEStream } from "@/lib/api";
import { CHAT_STREAM_ENDPOINT } from "@/lib/constants";
import type { ChatRequest, SSEDoneEvent } from "@/types";

/* Hook for streaming chat via SSE with token-by-token rendering. */
export function useChatStream() {
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendToken = useChatStore((s) => s.appendToken);
  const finishAssistantMessage = useChatStore((s) => s.finishAssistantMessage);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);
  const setErrorType = useChatStore((s) => s.setErrorType);

  const abortRef = useRef<AbortController | null>(null);

  const sendStream = useCallback(
    async (message: string) => {
      const { messages, conversationId } = useChatStore.getState();
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

      addUserMessage(message);
      setThinking(true);
      setErrorType(null);

      // Transition avatar to "listening" while waiting for the streamed answer
      const avatarStore = useAvatarStore.getState();
      if (avatarStore.isConnected) {
        useAvatarStore.getState().setState("listening");
      }

      try {
        const body: ChatRequest = { 
          message,
          conversation_id: conversationId,
          conversation_history: history,
        };
        const response = await api.stream(CHAT_STREAM_ENDPOINT, body, controller.signal);

        startAssistantMessage();

        await consumeSSEStream(
          response,
          /* onToken */
          (token: string) => appendToken(token),
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
      setThinking,
      startAssistantMessage,
      appendToken,
      finishAssistantMessage,
      addAssistantMessage,
      setErrorType,
    ],
  );

  /* Cancel in-flight stream. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { sendStream, cancel };
}
