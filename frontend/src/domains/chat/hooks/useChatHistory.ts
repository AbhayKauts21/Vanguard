"use client";

import { useCallback, useEffect } from "react";

import {
  createPersistedChat,
  getPersistedChatMessages,
  listPersistedChats,
} from "@/domains/chat/api/chat-api";
import { useAuthStore } from "@/domains/auth/model";
import { mapPersistedMessageToChatMessage, useChatStore } from "@/domains/chat/model";

export function useChatHistory() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const setGuestMode = useChatStore((state) => state.setGuestMode);
  const setUserMode = useChatStore((state) => state.setUserMode);
  const clearAuthenticatedState = useChatStore((state) => state.clearAuthenticatedState);
  const setChatSummaries = useChatStore((state) => state.setChatSummaries);
  const upsertChatSummary = useChatStore((state) => state.upsertChatSummary);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const setChatMessages = useChatStore((state) => state.setChatMessages);
  const setLoadingChats = useChatStore((state) => state.setLoadingChats);
  const setLoadingMessages = useChatStore((state) => state.setLoadingMessages);

  const loadChat = useCallback(
    async (chatId: string) => {
      const messageCache = useChatStore.getState().messageCache;
      const cached = messageCache[chatId];
      if (cached) {
        setActiveChat(chatId, cached);
        return;
      }

      setLoadingMessages(true);
      try {
        const response = await getPersistedChatMessages(chatId);
        const messages = response.items.map(mapPersistedMessageToChatMessage);
        setChatMessages(chatId, messages);
        setActiveChat(chatId, messages);
        upsertChatSummary(response.chat);
      } finally {
        setLoadingMessages(false);
      }
    },
    [setActiveChat, setChatMessages, setLoadingMessages, upsertChatSummary],
  );

  const refreshChats = useCallback(async () => {
    if (!isAuthenticated) {
      setGuestMode();
      return;
    }

    setLoadingChats(true);
    try {
      setUserMode();
      const response = await listPersistedChats();
      setChatSummaries(response.items);

      const currentActiveChatId = useChatStore.getState().activeChatId;

      const selected =
        (currentActiveChatId && response.items.find((item) => item.id === currentActiveChatId)?.id) ??
        response.items[0]?.id ??
        null;

      if (selected) {
        await loadChat(selected);
      } else {
        setActiveChat(null, []);
      }
    } finally {
      setLoadingChats(false);
    }
  }, [
    isAuthenticated,
    loadChat,
    setActiveChat,
    setChatSummaries,
    setGuestMode,
    setLoadingChats,
    setUserMode,
  ]);

  const createNewChat = useCallback(async () => {
    const summary = await createPersistedChat();
    upsertChatSummary(summary);
    setActiveChat(summary.id, []);
    return summary.id;
  }, [setActiveChat, upsertChatSummary]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      clearAuthenticatedState();
      return;
    }

    void refreshChats();
  }, [clearAuthenticatedState, isAuthenticated, refreshChats, userId]);

  return {
    createNewChat,
    loadChat,
    refreshChats,
  };
}
