"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/domains/chat/model";
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
      /* Cancel any in-flight stream. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      addUserMessage(message);
      setThinking(true);
      setErrorType(null);

      try {
        const body: ChatRequest = { message };
        const response = await api.stream(CHAT_STREAM_ENDPOINT, body, controller.signal);

        startAssistantMessage();

        await consumeSSEStream(
          response,
          /* onToken */
          (token: string) => appendToken(token),
          /* onDone */
          (event: SSEDoneEvent) => finishAssistantMessage({
            primary_citations: event.primary_citations || [],
            secondary_citations: event.secondary_citations || [],
            all_citations: event.all_citations || [],
            hidden_sources_count: event.hidden_sources_count || 0
          }),
          /* onError */
          (err: Error) => {
            finishAssistantMessage({
              primary_citations: [],
              secondary_citations: [],
              all_citations: [],
              hidden_sources_count: 0
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
