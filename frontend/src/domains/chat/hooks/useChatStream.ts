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

  const abortRef = useRef<AbortController | null>(null);

  const sendStream = useCallback(
    async (message: string) => {
      /* Cancel any in-flight stream. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      addUserMessage(message);
      setThinking(true);

      try {
        const body: ChatRequest = { message };
        const response = await api.stream(CHAT_STREAM_ENDPOINT, body, controller.signal);

        startAssistantMessage();

        await consumeSSEStream(
          response,
          /* onToken */
          (token: string) => appendToken(token),
          /* onDone */
          (event: SSEDoneEvent) => finishAssistantMessage(event.citations),
          /* onError */
          (err: Error) => {
            finishAssistantMessage([]);
            addAssistantMessage(`Stream error: ${err.message}`, []);
          },
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setThinking(false);
        const errorMsg = err instanceof Error ? err.message : "Streaming failed.";
        addAssistantMessage(errorMsg, []);
      }
    },
    [
      addUserMessage,
      setThinking,
      startAssistantMessage,
      appendToken,
      finishAssistantMessage,
      addAssistantMessage,
    ],
  );

  /* Cancel in-flight stream. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { sendStream, cancel };
}
