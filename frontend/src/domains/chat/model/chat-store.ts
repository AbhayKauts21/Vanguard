import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

import type { ChatMessage } from "@/components/chat";
import type { ChatSummary, Citation } from "@/types";

export const CHAT_STORAGE_KEY = "cleo-chat-session";

type ChatMode = "guest" | "user";
type ChatErrorType = "network" | "server" | "rate-limit" | null;

/* Generates unique message IDs. */
let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

interface ChatState {
  mode: ChatMode;
  messages: ChatMessage[];
  guestMessages: ChatMessage[];
  chatSummaries: ChatSummary[];
  activeChatId: string | null;
  messageCache: Record<string, ChatMessage[]>;
  messagePageInfo: Record<string, ChatPageInfo>;
  isThinking: boolean;
  streamingMessageId: string | null;
  errorType: ChatErrorType;
  conversationId: string;
  guestConversationId: string;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isLoadingOlderMessages: boolean;
  isHistoryCollapsed: boolean;

  addUserMessage: (content: string) => string;
  startAssistantMessage: () => string;
  appendToken: (token: string) => void;
  finishAssistantMessage: (data: {
    primary_citations: Citation[];
    secondary_citations: Citation[];
    all_citations: Citation[];
    hidden_sources_count: number;
    mode_used: "rag" | "uncertain" | "azure_fallback" | "shortcut";
    max_confidence: number;
    what_i_found?: { page_title: string; score: number }[];
  }) => void;
  addAssistantMessage: (content: string, primary_citations?: Citation[]) => void;
  setThinking: (val: boolean) => void;
  setErrorType: (err: ChatErrorType) => void;
  clearMessages: () => void;
  newConversation: () => void;
  setGuestMode: () => void;
  setUserMode: () => void;
  clearAuthenticatedState: () => void;
  setChatSummaries: (items: ChatSummary[]) => void;
  upsertChatSummary: (item: ChatSummary) => void;
  setActiveChat: (chatId: string | null, messages?: ChatMessage[]) => void;
  setChatMessages: (chatId: string, messages: ChatMessage[], pageInfo?: ChatPageInfo) => void;
  prependChatMessages: (chatId: string, messages: ChatMessage[], pageInfo?: ChatPageInfo) => void;
  setLoadingChats: (val: boolean) => void;
  setLoadingMessages: (val: boolean) => void;
  setLoadingOlderMessages: (val: boolean) => void;
  deleteConversation: (chatId: string) => Promise<void>;
  setHistoryCollapsed: (val: boolean) => void;
  toggleHistory: () => void;
}

interface PersistedGuestState {
  guestMessages?: ChatMessage[];
  guestConversationId?: string;
}

interface ChatPageInfo {
  hasMore: boolean;
  nextBefore: string | null;
}

function safeSessionStorage() {
  try {
    return sessionStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
}

function sortChatSummaries(items: ChatSummary[]): ChatSummary[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updated_at).getTime();
    const bTime = new Date(b.updated_at).getTime();
    return bTime - aTime;
  });
}

function currentMessagesForState(state: ChatState): ChatMessage[] {
  if (state.mode === "guest") return state.guestMessages;
  if (state.activeChatId) return state.messageCache[state.activeChatId] ?? state.messages;
  return state.messages;
}

function applyCurrentMessages(state: ChatState, nextMessages: ChatMessage[]): Partial<ChatState> {
  if (state.mode === "guest") {
    return {
      messages: nextMessages,
      guestMessages: nextMessages,
    };
  }

  if (state.activeChatId) {
    return {
      messages: nextMessages,
      messageCache: {
        ...state.messageCache,
        [state.activeChatId]: nextMessages,
      },
    };
  }

  return { messages: nextMessages };
}

export function mapPersistedMessageToChatMessage(message: {
  id: string;
  sender: "user" | "assistant";
  content: string;
  primary_citations?: Citation[];
  secondary_citations?: Citation[];
  all_citations?: Citation[];
  hidden_sources_count?: number;
  mode_used?: "rag" | "uncertain" | "azure_fallback" | "shortcut" | null;
  max_confidence?: number | null;
  what_i_found?: { page_title: string; score: number }[] | null;
}): ChatMessage {
  return {
    id: message.id,
    role: message.sender,
    content: message.content,
    primary_citations: message.primary_citations ?? [],
    secondary_citations: message.secondary_citations ?? [],
    all_citations: message.all_citations ?? [],
    hidden_sources_count: message.hidden_sources_count ?? 0,
    modeUsed: message.mode_used ?? undefined,
    maxConfidence: message.max_confidence ?? undefined,
    whatIFound: message.what_i_found ?? undefined,
    isStreaming: false,
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      mode: "guest",
      messages: [],
      guestMessages: [],
      chatSummaries: [],
      activeChatId: null,
      messageCache: {},
      messagePageInfo: {},
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
      conversationId: uuidv4(),
      guestConversationId: uuidv4(),
      isLoadingChats: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isHistoryCollapsed: false,

      addUserMessage: (content) => {
        const id = nextId();
        set((state) => {
          const nextMessages: ChatMessage[] = [
            ...currentMessagesForState(state),
            { id, role: "user", content },
          ];
          return applyCurrentMessages(state, nextMessages);
        });
        return id;
      },

      startAssistantMessage: () => {
        const id = nextId();
        set((state) => {
          const nextMessages: ChatMessage[] = [
            ...currentMessagesForState(state),
            { id, role: "assistant", content: "", isStreaming: true },
          ];
          return {
            ...applyCurrentMessages(state, nextMessages),
            streamingMessageId: id,
            isThinking: false,
          };
        });
        return id;
      },

      appendToken: (token) => {
        set((state) => {
          const nextMessages = currentMessagesForState(state).map((message) =>
            message.id === state.streamingMessageId
              ? { ...message, content: message.content + token }
              : message,
          );
          return applyCurrentMessages(state, nextMessages);
        });
      },

      finishAssistantMessage: (data) => {
        set((state) => {
          const nextMessages = currentMessagesForState(state).map((message) =>
            message.id === state.streamingMessageId
              ? {
                  ...message,
                  isStreaming: false,
                  primary_citations: data.primary_citations,
                  secondary_citations: data.secondary_citations,
                  all_citations: data.all_citations,
                  hidden_sources_count: data.hidden_sources_count,
                  modeUsed: data.mode_used,
                  maxConfidence: data.max_confidence,
                  whatIFound: data.what_i_found,
                }
              : message,
          );
          return {
            ...applyCurrentMessages(state, nextMessages),
            streamingMessageId: null,
          };
        });
      },

      addAssistantMessage: (content, primary_citations = []) => {
        const id = nextId();
        set((state) => {
          const nextMessages: ChatMessage[] = [
            ...currentMessagesForState(state),
            {
              id,
              role: "assistant",
              content,
              primary_citations,
              secondary_citations: [],
              all_citations: primary_citations,
              hidden_sources_count: 0,
            },
          ];
          return {
            ...applyCurrentMessages(state, nextMessages),
            isThinking: false,
          };
        });
      },

      setThinking: (val) => set({ isThinking: val }),

      setErrorType: (err) => set({ errorType: err }),

      clearMessages: () =>
        set((state) => {
          if (state.mode === "guest") {
            return {
              messages: [],
              guestMessages: [],
              streamingMessageId: null,
              isThinking: false,
              errorType: null,
            };
          }
          return {
            messages: [],
            messageCache: state.activeChatId
              ? { ...state.messageCache, [state.activeChatId]: [] }
              : state.messageCache,
            streamingMessageId: null,
            isThinking: false,
            errorType: null,
          };
        }),

      newConversation: () =>
        set((state) => {
          if (state.mode !== "guest") {
            return {};
          }
          const guestConversationId = uuidv4();
          return {
            messages: [],
            guestMessages: [],
            streamingMessageId: null,
            isThinking: false,
            errorType: null,
            conversationId: guestConversationId,
            guestConversationId,
          };
        }),

      setGuestMode: () =>
        set((state) => ({
          mode: "guest",
          messages: state.guestMessages,
          conversationId: state.guestConversationId,
          activeChatId: null,
          streamingMessageId: null,
          isThinking: false,
          errorType: null,
          isLoadingMessages: false,
          isLoadingOlderMessages: false,
        })),

      setUserMode: () =>
        set({
          mode: "user",
          messages: [],
          conversationId: "SESSION_USER",
          activeChatId: null,
          streamingMessageId: null,
          isThinking: false,
          errorType: null,
        }),

      clearAuthenticatedState: () =>
        set((state) => ({
          mode: "guest",
          messages: state.guestMessages,
          chatSummaries: [],
          activeChatId: null,
          messageCache: {},
          messagePageInfo: {},
          conversationId: state.guestConversationId,
          streamingMessageId: null,
          isThinking: false,
          errorType: null,
          isLoadingChats: false,
          isLoadingMessages: false,
          isLoadingOlderMessages: false,
        })),

      setChatSummaries: (items) =>
        set({
          chatSummaries: sortChatSummaries(items),
        }),

      upsertChatSummary: (item) =>
        set((state) => {
          const existing = state.chatSummaries.filter((summary) => summary.id !== item.id);
          return {
            chatSummaries: sortChatSummaries([item, ...existing]),
          };
        }),

      setActiveChat: (chatId, messages = []) =>
        set((state) => ({
          mode: "user",
          activeChatId: chatId,
          conversationId: chatId ?? "SESSION_USER",
          messages,
          messageCache: chatId
            ? {
                ...state.messageCache,
                [chatId]: messages,
              }
            : state.messageCache,
          streamingMessageId: null,
          errorType: null,
          isLoadingMessages: false,
          isLoadingOlderMessages: false,
        })),

      setChatMessages: (chatId, messages, pageInfo) =>
        set((state) => ({
          messageCache: {
            ...state.messageCache,
            [chatId]: messages,
          },
          messagePageInfo: pageInfo
            ? {
                ...state.messagePageInfo,
                [chatId]: pageInfo,
              }
            : state.messagePageInfo,
          messages: state.activeChatId === chatId ? messages : state.messages,
          isLoadingMessages: false,
        })),

      prependChatMessages: (chatId, messages, pageInfo) =>
        set((state) => {
          const existingMessages = state.messageCache[chatId] ?? [];
          const nextMessages = [...messages, ...existingMessages];
          return {
            messageCache: {
              ...state.messageCache,
              [chatId]: nextMessages,
            },
            messagePageInfo: pageInfo
              ? {
                  ...state.messagePageInfo,
                  [chatId]: pageInfo,
                }
              : state.messagePageInfo,
            messages: state.activeChatId === chatId ? nextMessages : state.messages,
            isLoadingOlderMessages: false,
          };
        }),

      setLoadingChats: (val) => set({ isLoadingChats: val }),
      setLoadingMessages: (val) => set({ isLoadingMessages: val }),
      setLoadingOlderMessages: (val) => set({ isLoadingOlderMessages: val }),

      deleteConversation: async (chatId) => {
        const { deletePersistedChat } = await import("../api/chat-api");
        await deletePersistedChat(chatId);

        set((state) => {
          const nextSummaries = state.chatSummaries.filter((s) => s.id !== chatId);
          const isDeletingActive = state.activeChatId === chatId;

          if (isDeletingActive) {
            const nextGuestId = uuidv4();
            const nextMessageCache = { ...state.messageCache };
            delete nextMessageCache[chatId];
            const nextMessagePageInfo = { ...state.messagePageInfo };
            delete nextMessagePageInfo[chatId];
            return {
              chatSummaries: nextSummaries,
              activeChatId: null,
              messages: [],
              conversationId: nextGuestId,
              guestConversationId: nextGuestId,
              guestMessages: [],
              messageCache: nextMessageCache,
              messagePageInfo: nextMessagePageInfo,
              streamingMessageId: null,
              isThinking: false,
              errorType: null,
            };
          }

          const nextMessageCache = { ...state.messageCache };
          delete nextMessageCache[chatId];
          const nextMessagePageInfo = { ...state.messagePageInfo };
          delete nextMessagePageInfo[chatId];
          return {
            chatSummaries: nextSummaries,
            messageCache: nextMessageCache,
            messagePageInfo: nextMessagePageInfo,
          };
        });
      },

      setHistoryCollapsed: (val) => set({ isHistoryCollapsed: val }),
      toggleHistory: () => set((state) => ({ isHistoryCollapsed: !state.isHistoryCollapsed })),
    }),
    {
      name: CHAT_STORAGE_KEY,
      storage: createJSONStorage(safeSessionStorage),
      partialize: (state): PersistedGuestState => ({
        guestMessages: state.guestMessages.map((message) => ({
          ...message,
          isStreaming: false,
        })),
        guestConversationId: state.guestConversationId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as PersistedGuestState) ?? {};
        const guestConversationId = persisted.guestConversationId ?? currentState.guestConversationId;
        const guestMessages = persisted.guestMessages ?? currentState.guestMessages;
        return {
          ...currentState,
          guestConversationId,
          guestMessages,
          messages: guestMessages,
          conversationId: guestConversationId,
        };
      },
    },
  ),
);
