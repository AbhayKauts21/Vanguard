import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { Citation } from "@/types";
import type { ChatMessage } from "@/components/chat";

/* Generates unique message IDs. */
let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  streamingMessageId: string | null;
  errorType: 'network' | 'server' | 'rate-limit' | null;
  conversationId: string;

  /* Add a user message. */
  addUserMessage: (content: string) => string;
  /* Start an assistant message (empty, streaming). */
  startAssistantMessage: () => string;
  /* Append a token to the streaming assistant message. */
  appendToken: (token: string) => void;
  /* Finalize the streaming message with citations. */
  finishAssistantMessage: (data: {
    primary_citations: Citation[];
    secondary_citations: Citation[];
    all_citations: Citation[];
    hidden_sources_count: number;
    mode_used: 'rag' | 'uncertain' | 'azure_fallback';
    max_confidence: number;
    what_i_found?: { page_title: string; score: number }[];
  }) => void;
  /* Set a complete assistant response (non-streaming) or error. */
  addAssistantMessage: (content: string, primary_citations?: Citation[]) => void;
  /* Mark thinking state. */
  setThinking: (val: boolean) => void;
  /* Set system error type. */
  setErrorType: (err: 'network' | 'server' | 'rate-limit' | null) => void;
  /* Clear all messages. */
  clearMessages: () => void;
  /* Reset session. */
  newConversation: () => void;
}

/* Zustand store for transient chat UI state. Persisted in sessionStorage. */
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
      conversationId: uuidv4(),

  addUserMessage: (content) => {
    const id = nextId();
    set((s) => ({
      messages: [...s.messages, { id, role: "user", content }],
    }));
    return id;
  },

  startAssistantMessage: () => {
    const id = nextId();
    set((s) => ({
      messages: [...s.messages, { id, role: "assistant", content: "", isStreaming: true }],
      streamingMessageId: id,
      isThinking: false,
    }));
    return id;
  },

  appendToken: (token) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === s.streamingMessageId ? { ...m, content: m.content + token } : m,
      ),
    }));
  },

  finishAssistantMessage: (data) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === s.streamingMessageId ? { 
          ...m, 
          isStreaming: false, 
          primary_citations: data.primary_citations,
          secondary_citations: data.secondary_citations,
          all_citations: data.all_citations,
          hidden_sources_count: data.hidden_sources_count,
          modeUsed: data.mode_used,
          maxConfidence: data.max_confidence,
          whatIFound: data.what_i_found
        } : m
      ),
      streamingMessageId: null,
    }));
  },

  addAssistantMessage: (content, primary_citations = []) => {
    const id = nextId();
    set((s) => ({
      messages: [...s.messages, { 
        id, 
        role: "assistant", 
        content, 
        primary_citations, 
        secondary_citations: [], 
        all_citations: primary_citations, 
        hidden_sources_count: 0 
      }],
      isThinking: false,
    }));
  },

  setThinking: (val) => set({ isThinking: val }),

  setErrorType: (err) => set({ errorType: err }),

  clearMessages: () => set({ messages: [], streamingMessageId: null, isThinking: false, errorType: null }),

  newConversation: () => set({
    messages: [],
    streamingMessageId: null,
    isThinking: false,
    errorType: null,
    conversationId: uuidv4(),
  }),
    }),
    {
      name: "cleo-chat-session",
      storage: createJSONStorage(() => {
        try {
          return sessionStorage;
        } catch (_e) {
          // SSR fallback
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
      }),
      partialize: (state) => ({
        messages: state.messages.map(m => ({ ...m, isStreaming: false })),
        conversationId: state.conversationId,
      }),
    }
  )
);
