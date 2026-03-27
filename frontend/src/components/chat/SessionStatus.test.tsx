import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionStatus } from "./SessionStatus";
import { useChatStore } from "@/domains/chat/model";

const messages = {
  chat: {
    sessionStable: "Uplink Stable",
  },
  header: {
    newSession: "New Session",
    newChat: "New Chat",
    clearThread: "Clear Thread",
  },
};

function renderWithIntl(onNewChat?: () => void) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SessionStatus onNewChat={onNewChat} />
    </NextIntlClientProvider>,
  );
}

describe("SessionStatus", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useChatStore.setState({
      mode: "guest",
      messages: [],
      guestMessages: [],
      conversationId: "fd8092da-1234-5678-9abc-def012345678",
      guestConversationId: "fd8092da-1234-5678-9abc-def012345678",
      activeChatId: null,
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
    });
  });

  it("renders a stable fallback session label during server render", () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SessionStatus />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("SESSION_CLEO");
  });

  it("shows the hydrated conversation label after mount", async () => {
    renderWithIntl();

    await waitFor(() => {
      expect(screen.getByText("SESSION_FD8092DA")).toBeInTheDocument();
    });
  });

  it("renders guest actions and clears the thread from the panel header", () => {
    useChatStore.setState({
      mode: "guest",
      messages: [{ id: "msg-1", role: "user", content: "hello" }],
      guestMessages: [{ id: "msg-1", role: "user", content: "hello" }],
    });

    renderWithIntl();

    fireEvent.click(screen.getByRole("button", { name: "Clear Thread" }));

    expect(useChatStore.getState().messages).toEqual([]);
    expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
  });

  it("uses the user chat action when authenticated mode is active", () => {
    const onNewChat = vi.fn();
    useChatStore.setState({
      mode: "user",
      conversationId: "chat-1234",
      messages: [{ id: "msg-1", role: "assistant", content: "Saved" }],
    });

    renderWithIntl(onNewChat);

    fireEvent.click(screen.getByRole("button", { name: "New Chat" }));

    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Clear Thread" })).not.toBeInTheDocument();
  });
});
