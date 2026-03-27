import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { SessionStatus } from "./SessionStatus";
import { useChatStore } from "@/domains/chat/model";

const messages = {
  chat: {
    sessionStable: "Uplink Stable",
  },
  header: {
    newSession: "New Session",
    clearThread: "Clear Thread",
  },
};

function renderWithIntl() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SessionStatus />
    </NextIntlClientProvider>,
  );
}

describe("SessionStatus", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useChatStore.setState({
      messages: [],
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
      conversationId: "fd8092da-1234-5678-9abc-def012345678",
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

  it("renders chat actions and clears the thread from the panel header", () => {
    useChatStore.setState({
      messages: [{ id: "msg-1", role: "user", content: "hello" }],
    });

    renderWithIntl();

    fireEvent.click(screen.getByRole("button", { name: "Clear Thread" }));

    expect(useChatStore.getState().messages).toEqual([]);
    expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
  });
});
