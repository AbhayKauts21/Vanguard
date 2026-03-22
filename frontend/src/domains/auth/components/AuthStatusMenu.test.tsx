import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStatusMenu } from "./AuthStatusMenu";
import { useAuthStore } from "@/domains/auth/model";

const pushMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("@/domains/auth/api", () => ({
  authApi: {
    logout: (...args: unknown[]) => logoutMock(...args),
  },
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
  useRouter: () => ({ push: pushMock }),
}));

const messages = {
  account: {
    login: "Login",
    register: "Register",
    openMenu: "Open account menu",
    signedIn: "Authenticated session",
    unnamedUser: "Unnamed user",
    role: "Role",
    permissions: "Permissions",
    goToChat: "Neural Link",
    goToSystem: "System Console",
    logout: "Sign out",
    loggingOut: "Signing out...",
  },
};

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("AuthStatusMenu", () => {
  beforeEach(() => {
    pushMock.mockReset();
    logoutMock.mockReset();
    useAuthStore.getState().clearSession();
  });

  it("renders login and register links when no user is authenticated", () => {
    renderWithIntl(<AuthStatusMenu />);

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });

  it("shows current role and logs out authenticated users", async () => {
    logoutMock.mockResolvedValueOnce({ status: "success", detail: "done" });
    useAuthStore.getState().setSession({
      access_token: "access-123",
      refresh_token: "refresh-123",
      token_type: "bearer",
      access_token_expires_in: 1800,
      refresh_token_expires_in: 1209600,
      user: {
        id: "user-1",
        email: "operator@example.com",
        full_name: "Operator",
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: null,
        roles: [
          {
            id: "role-1",
            name: "admin",
            description: "Admin",
            permissions: [],
          },
        ],
        permissions: [
          { id: "perm-1", code: "sync:manage", description: "Sync" },
          { id: "perm-2", code: "rbac:manage", description: "RBAC" },
        ],
      },
    });

    const user = userEvent.setup();
    renderWithIntl(<AuthStatusMenu />);

    expect(screen.getByText("admin")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open account menu" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Authenticated session")).toBeInTheDocument();
    expect(within(menu).getByText("Operator")).toBeInTheDocument();
    expect(within(menu).getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledWith("refresh-123");
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
