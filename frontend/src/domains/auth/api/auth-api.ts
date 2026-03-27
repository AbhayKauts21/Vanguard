import { api } from "@/lib/api/client";
import type {
  AuthSessionResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  StatusMessageResponse,
} from "@/types";

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<AuthSessionResponse>("/api/v1/auth/login", body),

  register: (body: RegisterRequest) =>
    api.post<AuthSessionResponse>("/api/v1/auth/register", body),

  forgotPassword: (body: ForgotPasswordRequest) =>
    api.post<StatusMessageResponse>("/api/v1/auth/forgot-password", body),

  resetPassword: (body: ResetPasswordRequest) =>
    api.post<StatusMessageResponse>("/api/v1/auth/reset-password", body),

  logout: (refreshToken: string) =>
    api.post<StatusMessageResponse>("/api/v1/auth/logout", {
      refresh_token: refreshToken,
    }),

  me: () => api.get<AuthSessionResponse["user"]>("/api/v1/auth/me"),
};
