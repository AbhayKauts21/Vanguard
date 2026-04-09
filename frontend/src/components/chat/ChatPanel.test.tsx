import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("ChatPanel voice interrupt integration", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
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
      conversationId: "guest-conversation",
      guestConversationId: "guest-conversation",
      isLoadingChats: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isHistoryCollapsed: false,
    });
  });

  it("passes onInterrupt through to the HUD and only shows it once speaking starts", () => {
    const onInterrupt = vi.fn();

    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "processing",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      isSpeakingPlayback: false,
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
          phase: "processing",
          onActivate: vi.fn(),
          onDeactivate: vi.fn(),
          onInterrupt,
          onSendVoiceMessage: vi.fn(),
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("speaking");
      useVoiceStore.getState().setSpeakingPlayback(true);
    });

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));

    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });
});
