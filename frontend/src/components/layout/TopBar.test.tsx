import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";
import { useChatStore } from "@/domains/chat/model";

vi.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div>Language Switcher</div>,
}));

vi.mock("@/domains/auth/components", () => ({
  AuthStatusMenu: () => <div>Auth Menu</div>,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const messages = {
  header: {
    newSession: "New Session",
    clearThread: "Clear Thread",
    focusInput: "Focus Input",
    adminConsole: "Admin Console",
    pulseInterface: "Pulse interface",
  },
};

describe("TopBar", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [{ id: "msg-1", role: "user", content: "hello" }],
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
      conversationId: "session-a",
    });
  });

  it("renders functional controls and clears the thread", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TopBar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear Thread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Focus Input" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin Console" })).toHaveAttribute("href", "/admin");

    fireEvent.click(screen.getByRole("button", { name: "Clear Thread" }));

    expect(useChatStore.getState().messages).toEqual([]);
  });
});
