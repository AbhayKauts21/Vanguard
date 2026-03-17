import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/domains/chat/model/chat-store";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages();
  });

  it("starts with empty state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isThinking).toBe(false);
    expect(state.streamingMessageId).toBeNull();
  });

  it("adds a user message", () => {
    const id = useChatStore.getState().addUserMessage("Hello CLEO");
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      id,
      role: "user",
      content: "Hello CLEO",
    });
  });

  it("adds a complete assistant message", () => {
    useChatStore.getState().addAssistantMessage("Answer", [
      { page_id: 1, page_title: "Test", page_url: "http://test.com", snippet: "..." },
    ]);
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe("assistant");
    expect(state.messages[0].citations).toHaveLength(1);
    expect(state.isThinking).toBe(false);
  });

  it("handles streaming lifecycle: start → append → finish", () => {
    const id = useChatStore.getState().startAssistantMessage();
    let state = useChatStore.getState();
    expect(state.streamingMessageId).toBe(id);
    expect(state.messages[0].isStreaming).toBe(true);
    expect(state.messages[0].content).toBe("");

    useChatStore.getState().appendToken("Hello ");
    useChatStore.getState().appendToken("world");
    state = useChatStore.getState();
    expect(state.messages[0].content).toBe("Hello world");

    useChatStore.getState().finishAssistantMessage([]);
    state = useChatStore.getState();
    expect(state.messages[0].isStreaming).toBe(false);
    expect(state.streamingMessageId).toBeNull();
  });

  it("sets and clears thinking state", () => {
    useChatStore.getState().setThinking(true);
    expect(useChatStore.getState().isThinking).toBe(true);

    useChatStore.getState().setThinking(false);
    expect(useChatStore.getState().isThinking).toBe(false);
  });

  it("clears all messages", () => {
    useChatStore.getState().addUserMessage("Test");
    useChatStore.getState().addAssistantMessage("Reply", []);
    useChatStore.getState().clearMessages();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isThinking).toBe(false);
    expect(state.streamingMessageId).toBeNull();
  });
});
