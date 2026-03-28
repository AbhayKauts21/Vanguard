"use client";

import { useCallback } from "react";
import { useChatStore } from "@/domains/chat/model";
import { useAuthStore } from "@/domains/auth/model";
import {
  createPersistedChat,
  sendChatMessage,
  sendPersistedChatMessage,
} from "@/domains/chat/api";
import { mapPersistedMessageToChatMessage } from "@/domains/chat/model";
import type { ChatRequest } from "@/types";

/* Hook to send a non-streaming chat message and update the store. */
export function useChat() {
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);
  const setChatMessages = useChatStore((s) => s.setChatMessages);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const upsertChatSummary = useChatStore((s) => s.upsertChatSummary);
  const setErrorType = useChatStore((s) => s.setErrorType);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const send = useCallback(
    async (message: string) => {
      try {
        if (isAuthenticated) {
          const state = useChatStore.getState();
          let chatId = state.activeChatId;
          if (!chatId) {
            const summary = await createPersistedChat();
            upsertChatSummary(summary);
            setActiveChat(summary.id, []);
            chatId = summary.id;
          }

          addUserMessage(message);
          setThinking(true);
          setErrorType(null);

          const res = await sendPersistedChatMessage(chatId, message);
          const currentMessages = useChatStore.getState().messages;
          const nextMessages = [
            ...currentMessages.slice(0, -1),
            mapPersistedMessageToChatMessage(res.user_message),
            mapPersistedMessageToChatMessage(res.assistant_message),
          ];
          setChatMessages(chatId, nextMessages);
          upsertChatSummary(res.chat);
          setThinking(false);
          return;
        }

        addUserMessage(message);
        setThinking(true);
        setErrorType(null);

        const body: ChatRequest = { message };
        const res = await sendChatMessage(body);
        addAssistantMessage(res.answer, res.primary_citations);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setErrorType("server");
        addAssistantMessage(errorMsg, []);
        setThinking(false);
      }
    },
    [
      addAssistantMessage,
      addUserMessage,
      isAuthenticated,
      setActiveChat,
      setChatMessages,
      setErrorType,
      setThinking,
      upsertChatSummary,
    ],
  );

  return { send };
}
