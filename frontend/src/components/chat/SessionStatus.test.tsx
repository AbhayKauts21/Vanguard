import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { SessionStatus } from "./SessionStatus";
import { useChatStore } from "@/domains/chat/model";

const messages = {
  chat: {
    sessionStable: "Uplink Stable",
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
});
