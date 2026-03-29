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
const forgotPasswordMock = vi.fn();
const resetPasswordMock = vi.fn();

vi.mock("@/domains/auth/api", () => ({
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
    register: (...args: unknown[]) => registerMock(...args),
    forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args),
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
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
    resetCode: "Reset code",
    resetCodePlaceholder: "Enter the 6-digit code",
    newPassword: "New password",
    newPasswordPlaceholder: "Create a new password",
    forgotRequestSubmit: "Send reset code",
    forgotResetSubmit: "Update password",
    forgotRequestLoading: "Sending code...",
    forgotResetLoading: "Updating password...",
    forgotRequestHint:
      "Enter the email tied to your account. If it exists, we'll issue a one-time reset code and log it on the backend for local development.",
    requestNewCode: "Request a new code",
    needAccount: "Need an account?",
    haveAccount: "Already have access?",
    passwordMismatch: "Passwords do not match.",
    loginSuccess: "Signed in successfully. Redirecting...",
    registerSuccess: "Account created. Redirecting...",
    genericError: "We couldn't complete that request. Please try again.",
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
    forgotPasswordMock.mockReset();
    resetPasswordMock.mockReset();
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

  it("requests a reset code and advances to the password update step", async () => {
    forgotPasswordMock.mockResolvedValueOnce({
      status: "ok",
      detail:
        "If an account exists for that email, a reset code has been generated. Check the backend logs in local development.",
    });
    const user = userEvent.setup();

    renderWithIntl(<ForgotPasswordCard />);

    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));

    await waitFor(() => {
      expect(forgotPasswordMock).toHaveBeenCalledWith({
        email: "operator@example.com",
      });
    });
    expect(screen.getByLabelText("Reset code")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("submits the reset payload once the code and new password are provided", async () => {
    forgotPasswordMock.mockResolvedValueOnce({
      status: "ok",
      detail: "Check the backend logs.",
    });
    resetPasswordMock.mockResolvedValueOnce({
      status: "ok",
      detail: "Your password has been updated. You can sign in now.",
    });
    const user = userEvent.setup();

    renderWithIntl(<ForgotPasswordCard />);

    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));
    await screen.findByLabelText("Reset code");

    await user.type(screen.getByLabelText("Reset code"), "654321");
    await user.type(screen.getByLabelText("New password"), "NewStrongPass123");
    await user.type(screen.getByLabelText("Confirm password"), "NewStrongPass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith({
        email: "operator@example.com",
        code: "654321",
        new_password: "NewStrongPass123",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your password has been updated. You can sign in now.",
    );
  });

  it("blocks password reset submission when the new passwords do not match", async () => {
    forgotPasswordMock.mockResolvedValueOnce({
      status: "ok",
      detail: "Check the backend logs.",
    });
    const user = userEvent.setup();

    renderWithIntl(<ForgotPasswordCard />);

    await user.type(screen.getByLabelText("Email"), "operator@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));
    await screen.findByLabelText("Reset code");

    await user.type(screen.getByLabelText("Reset code"), "654321");
    await user.type(screen.getByLabelText("New password"), "NewStrongPass123");
    await user.type(screen.getByLabelText("Confirm password"), "DifferentPass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(resetPasswordMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match.",
    );
  });

  it("keeps the back-to-login route available on the forgot-password screen", () => {
    renderWithIntl(<ForgotPasswordCard />);

    expect(screen.getByRole("link", { name: "Return to login" })).toBeInTheDocument();
  });
});
