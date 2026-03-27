import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { ChatHistoryRail } from "./ChatHistoryRail";

const messages = {
  chat: {
    historyTitle: "Chat History",
    historySubtitle: "Your saved conversations",
    historyEmpty: "Start a new chat to save a conversation for this account.",
    historyNoMessages: "No messages yet",
    historyMessageCount: "{count} messages",
    historyCollapse: "Hide history",
    untitledChat: "New chat",
  },
  header: {
    newChat: "New Chat",
  },
};

describe("ChatHistoryRail", () => {
  it("renders chats and allows selecting a different conversation", () => {
    const onSelectChat = vi.fn();
    const onCreateChat = vi.fn();

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatHistoryRail
          chats={[
            {
              id: "chat-1",
              title: "CheckingMate setup",
              created_at: "2026-03-27T08:00:00Z",
              updated_at: "2026-03-27T09:30:00Z",
              message_count: 4,
              last_message_preview: "Deployment guide",
            },
            {
              id: "chat-2",
              title: null,
              created_at: "2026-03-27T10:00:00Z",
              updated_at: "2026-03-27T10:10:00Z",
              message_count: 0,
              last_message_preview: null,
            },
          ]}
          activeChatId="chat-1"
          onSelectChat={onSelectChat}
          onCreateChat={onCreateChat}
          onToggleCollapse={() => {}}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("CheckingMate setup")).toBeInTheDocument();
    expect(screen.getByText("New chat")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[3]);

    expect(onCreateChat).toHaveBeenCalledTimes(1);
    expect(onSelectChat).toHaveBeenCalledWith("chat-2");
  });
});
