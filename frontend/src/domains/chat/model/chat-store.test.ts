import { beforeEach, describe, expect, it } from "vitest";

import { useChatStore } from "@/domains/chat/model/chat-store";

function resetChatStore() {
  useChatStore.setState({
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
    conversationId: "guest-session",
    guestConversationId: "guest-session",
    isLoadingChats: false,
    isLoadingMessages: false,
    isLoadingOlderMessages: false,
    isHistoryCollapsed: false,
  });
}

describe("useChatStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetChatStore();
  });

  it("starts in guest mode with an empty state", () => {
    const state = useChatStore.getState();
    expect(state.mode).toBe("guest");
    expect(state.messages).toEqual([]);
    expect(state.chatSummaries).toEqual([]);
    expect(state.activeChatId).toBeNull();
  });

  it("handles the guest streaming lifecycle", () => {
    useChatStore.getState().addUserMessage("Hello CLEO");
    const id = useChatStore.getState().startAssistantMessage();

    useChatStore.getState().appendToken("Hello ");
    useChatStore.getState().appendToken("world");
    useChatStore.getState().finishAssistantMessage({
      primary_citations: [],
      secondary_citations: [],
      all_citations: [],
      hidden_sources_count: 0,
      mode_used: "rag",
      max_confidence: 0.95,
    });

    const state = useChatStore.getState();
    expect(state.streamingMessageId).toBeNull();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toMatchObject({
      id,
      role: "assistant",
      content: "Hello world",
      isStreaming: false,
    });
  });

  it("creates a new guest conversation without affecting persisted user chats", () => {
    useChatStore.getState().addUserMessage("Guest prompt");
    useChatStore.getState().newConversation();

    const state = useChatStore.getState();
    expect(state.mode).toBe("guest");
    expect(state.messages).toEqual([]);
    expect(state.guestMessages).toEqual([]);
    expect(state.conversationId).toBe(state.guestConversationId);
  });

  it("stores authenticated chat summaries and message caches separately from guest state", () => {
    useChatStore.getState().setUserMode();
    useChatStore.getState().setChatSummaries([
      {
        id: "chat-2",
        title: "Later chat",
        created_at: "2026-03-27T10:00:00Z",
        updated_at: "2026-03-27T11:00:00Z",
        message_count: 1,
        last_message_preview: "Second",
      },
      {
        id: "chat-1",
        title: "Earlier chat",
        created_at: "2026-03-27T08:00:00Z",
        updated_at: "2026-03-27T09:00:00Z",
        message_count: 2,
        last_message_preview: "First",
      },
    ]);
    useChatStore.getState().setActiveChat("chat-2", []);
    useChatStore.getState().setChatMessages(
      "chat-2",
      [{ id: "m-1", role: "user", content: "Persisted hello" }],
      { hasMore: true, nextBefore: "2026-03-27T08:00:00Z" },
    );

    const state = useChatStore.getState();
    expect(state.mode).toBe("user");
    expect(state.chatSummaries.map((chat) => chat.id)).toEqual(["chat-2", "chat-1"]);
    expect(state.activeChatId).toBe("chat-2");
    expect(state.messageCache["chat-2"]).toHaveLength(1);
    expect(state.messagePageInfo["chat-2"]).toEqual({
      hasMore: true,
      nextBefore: "2026-03-27T08:00:00Z",
    });
    expect(state.messages[0].content).toBe("Persisted hello");
    expect(state.guestMessages).toEqual([]);
  });

  it("clears authenticated state back to the guest session on logout", () => {
    useChatStore.setState({
      guestMessages: [{ id: "guest-1", role: "user", content: "Guest draft" }],
      messages: [{ id: "user-1", role: "assistant", content: "Persisted" }],
      chatSummaries: [
        {
          id: "chat-1",
          title: "Saved chat",
          created_at: "2026-03-27T10:00:00Z",
          updated_at: "2026-03-27T11:00:00Z",
          message_count: 2,
          last_message_preview: "Persisted",
        },
      ],
      activeChatId: "chat-1",
      messageCache: {
        "chat-1": [{ id: "user-1", role: "assistant", content: "Persisted" }],
      },
      messagePageInfo: {
        "chat-1": { hasMore: false, nextBefore: null },
      },
      mode: "user",
      conversationId: "chat-1",
      guestConversationId: "guest-session",
      isLoadingChats: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isHistoryCollapsed: false,
    });

    useChatStore.getState().clearAuthenticatedState();

    const state = useChatStore.getState();
    expect(state.mode).toBe("guest");
    expect(state.activeChatId).toBeNull();
    expect(state.chatSummaries).toEqual([]);
    expect(state.messageCache).toEqual({});
    expect(state.messagePageInfo).toEqual({});
    expect(state.messages).toEqual([{ id: "guest-1", role: "user", content: "Guest draft" }]);
    expect(state.conversationId).toBe("guest-session");
  });
});
