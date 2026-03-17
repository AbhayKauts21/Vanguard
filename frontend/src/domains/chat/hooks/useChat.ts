"use client";

import { useCallback } from "react";
import { useChatStore } from "@/domains/chat/model";
import { sendChatMessage } from "@/domains/chat/api";
import type { ChatRequest } from "@/types";

/* Hook to send a non-streaming chat message and update the store. */
export function useChat() {
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);

  const send = useCallback(
    async (message: string) => {
      addUserMessage(message);
      setThinking(true);

      try {
        const body: ChatRequest = { message };
        const res = await sendChatMessage(body);
        addAssistantMessage(res.answer, res.citations);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        addAssistantMessage(errorMsg, []);
      }
    },
    [addUserMessage, setThinking, addAssistantMessage],
  );

  return { send };
}
