import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

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
    focusInput: "Focus Input",
    focusInputHint: "Operator cursor",
    adminConsole: "Admin Console",
    adminConsoleHint: "System controls",
    pulseInterface: "Pulse interface",
  },
};

describe("TopBar", () => {
  it("renders bespoke header actions for input focus and admin access", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TopBar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Focus Input")).toBeInTheDocument();
    expect(screen.getByText("Operator cursor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin Console/i })).toHaveAttribute("href", "/admin");
  });
});
