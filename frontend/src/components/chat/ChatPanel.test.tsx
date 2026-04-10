import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import { useChatStore } from "@/domains/chat/model";
import { useVoiceStore } from "@/domains/voice/model";

vi.mock("./SessionStatus", () => ({
  SessionStatus: () => <div data-testid="session-status" />,
}));

vi.mock("./ChatHistoryRail", () => ({
  ChatHistoryRail: () => <div data-testid="chat-history-rail" />,
}));

vi.mock("./MessageList", () => ({
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock("./EmptyState", () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock("./TypingIndicator", () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

vi.mock("./Composer", () => ({
  Composer: () => <div data-testid="composer" />,
}));

vi.mock("./OfflineBanner", () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
}));

vi.mock("./SuggestedPromptRail", () => ({
  SuggestedPromptRail: () => <div data-testid="suggested-prompt-rail" />,
}));

describe("ChatPanel voice integration", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
    useChatStore.setState({
      mode: "guest",
      messages: [],
      guestMessages: [],
      activeChatId: null,
      messageCache: {},
      chatSummaries: [],
      messagePageInfo: {},
      streamingMessageId: null,
      isThinking: false,
      errorType: null,
      conversationId: "guest-conversation",
      guestConversationId: "guest-conversation",
      isLoadingChats: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isHistoryCollapsed: false,
    });
  });

  it("renders the voice HUD with manual interrupt only during speaking", () => {
    const onDeactivate = vi.fn();
    const onInterrupt = vi.fn();

    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "speaking",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
      isSupported: true,
    });

    render(
      <ChatPanel
        messages={[{ id: "assistant-1", role: "assistant", content: "hello" }]}
        isThinking={false}
        onSend={vi.fn()}
        voice={{
          isVoiceMode: true,
          isSupported: true,
          phase: "speaking",
          onActivate: vi.fn(),
          onDeactivate,
          onInterrupt,
          onSendVoiceMessage: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByText("CLEO is speaking. Interrupt to jump to the next question."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));
    expect(onInterrupt).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "End Session" }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });
});
