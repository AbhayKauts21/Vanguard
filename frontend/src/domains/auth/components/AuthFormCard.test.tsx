import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthFormCard } from "./AuthFormCard";
import { ForgotPasswordCard } from "./ForgotPasswordCard";
import { useAuthStore } from "@/domains/auth/model";

const pushMock = vi.fn();
const loginMock = vi.fn();
const registerMock = vi.fn();

vi.mock("@/domains/auth/api", () => ({
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
    register: (...args: unknown[]) => registerMock(...args),
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
  auth: {
    navLogin: "Login",
    navRegister: "Register",
    accessNode: "Open",
    intelEyebrow: "Identity lattice",
    email: "Email",
    emailPlaceholder: "operator@company.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Repeat your password",
    fullName: "Full name",
    fullNamePlaceholder: "Jane Developer",
    loginSubmit: "Enter CLEO",
    registerSubmit: "Create account",
    loginLoading: "Authenticating...",
    registerLoading: "Provisioning...",
    forgotPassword: "Forgot password?",
    backToLogin: "Return to login",
    needAccount: "Need an account?",
    haveAccount: "Already have access?",
    passwordMismatch: "Passwords do not match.",
    loginSuccess: "Signed in successfully. Redirecting...",
    registerSuccess: "Account created. Redirecting...",
    genericError: "We couldn't complete that request. Please try again.",
    forgotUnsupportedTitle: "Password recovery isn't available yet.",
    forgotUnsupportedBody:
      "Please return to login with your current password or contact your workspace administrator for help.",
    forgotUnsupportedHint: "Use your current password to sign in.",
  },
};

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

const authSession = {
  access_token: "access-123",
  refresh_token: "refresh-123",
  token_type: "bearer" as const,
  access_token_expires_in: 1800,
  refresh_token_expires_in: 1209600,
  user: {
    id: "user-1",
    email: "operator@example.com",
    full_name: "Operator",
    is_active: true,
    created_at: new Date().toISOString(),
    last_login_at: null,
    roles: [],
    permissions: [],
  },
};

describe("AuthFormCard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.getState().clearSession();
    pushMock.mockReset();
    loginMock.mockReset();
    registerMock.mockReset();
  });

  it("submits login credentials, stores the session, and redirects home", async () => {
    loginMock.mockResolvedValueOnce(authSession);
    const user = userEvent.setup();

    renderWithIntl(<AuthFormCard mode="login" />);

    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.type(screen.getByLabelText("Password"), "StrongPass123");
    await user.click(screen.getByRole("button", { name: "Enter CLEO" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: "operator@example.com",
        password: "StrongPass123",
      });
    });
    expect(useAuthStore.getState().accessToken).toBe("access-123");
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("blocks register submission when passwords do not match", async () => {
    const user = userEvent.setup();

    renderWithIntl(<AuthFormCard mode="register" />);

    await user.type(screen.getByLabelText("Full name"), "Operator");
    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.type(screen.getByLabelText("Password"), "StrongPass123");
    await user.type(screen.getByLabelText("Confirm password"), "StrongPass456");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(registerMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match.",
    );
  });

  it("submits registration payload and stores the created session", async () => {
    registerMock.mockResolvedValueOnce(authSession);
    const user = userEvent.setup();

    renderWithIntl(<AuthFormCard mode="register" />);

    await user.type(screen.getByLabelText("Full name"), "Operator");
    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.type(screen.getByLabelText("Password"), "StrongPass123");
    await user.type(screen.getByLabelText("Confirm password"), "StrongPass123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        email: "operator@example.com",
        password: "StrongPass123",
        full_name: "Operator",
      });
    });
    expect(useAuthStore.getState().user?.email).toBe("operator@example.com");
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("renders forgot-password as an informational screen because the backend lacks reset APIs", () => {
    renderWithIntl(<ForgotPasswordCard />);

    expect(
      screen.getByText("Password recovery isn't available yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });
});
