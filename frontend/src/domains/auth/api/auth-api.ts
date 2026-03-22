import { api } from "@/lib/api/client";
import type {
  AuthSessionResponse,
  LoginRequest,
  RegisterRequest,
} from "@/types";

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<AuthSessionResponse>("/api/v1/auth/login", body),

  register: (body: RegisterRequest) =>
    api.post<AuthSessionResponse>("/api/v1/auth/register", body),

  logout: (refreshToken: string) =>
    api.post<{ status: string; detail: string }>("/api/v1/auth/logout", {
      refresh_token: refreshToken,
    }),

  me: () => api.get<AuthSessionResponse["user"]>("/api/v1/auth/me"),
};
