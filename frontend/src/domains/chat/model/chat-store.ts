import { create } from "zustand";
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

  /* Add a user message. */
  addUserMessage: (content: string) => string;
  /* Start an assistant message (empty, streaming). */
  startAssistantMessage: () => string;
  /* Append a token to the streaming assistant message. */
  appendToken: (token: string) => void;
  /* Finalize the streaming message with citations. */
  finishAssistantMessage: (citations: Citation[]) => void;
  /* Set a complete assistant response (non-streaming). */
  addAssistantMessage: (content: string, citations: Citation[]) => void;
  /* Mark thinking state. */
  setThinking: (val: boolean) => void;
  /* Clear all messages. */
  clearMessages: () => void;
}

/* Zustand store for transient chat UI state. */
export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isThinking: false,
  streamingMessageId: null,

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

  finishAssistantMessage: (citations) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === s.streamingMessageId ? { ...m, isStreaming: false, citations } : m,
      ),
      streamingMessageId: null,
    }));
  },

  addAssistantMessage: (content, citations) => {
    const id = nextId();
    set((s) => ({
      messages: [...s.messages, { id, role: "assistant", content, citations }],
      isThinking: false,
    }));
  },

  setThinking: (val) => set({ isThinking: val }),

  clearMessages: () => set({ messages: [], streamingMessageId: null, isThinking: false }),
}));
