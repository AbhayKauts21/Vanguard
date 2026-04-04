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

vi.mock("@/domains/auth/model", () => ({
  useAuthStore: (selector: any) => selector({ user: { email: "test@example.com" } }),
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
    adminConsole: "Admin Console",
    adminConsoleHint: "System controls",
    documentsLibrary: "Documents",
    documentsLibraryHint: "Upload and review",
  },
};

describe("TopBar", () => {
  it("renders bespoke header actions for admin and documents access", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TopBar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Admin Console")).toBeInTheDocument();
    expect(screen.getByText("System controls")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Upload and review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin Console/i })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /Documents/i })).toHaveAttribute("href", "/documents");
  });
});
