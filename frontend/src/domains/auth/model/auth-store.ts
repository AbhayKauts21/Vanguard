import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthSessionResponse, AuthUser } from "@/types";

export const AUTH_STORAGE_KEY = "cleo-auth-session";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSessionResponse) => void;
  clearSession: () => void;
}

function safeSessionStorage() {
  try {
    return sessionStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
}

interface PersistedAuthState {
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: AuthUser | null;
  isAuthenticated?: boolean;
}

function readPersistedState(): PersistedAuthState | null {
  try {
    const raw = safeSessionStorage().getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: PersistedAuthState };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

export function getPersistedAccessToken(): string | null {
  return readPersistedState()?.accessToken ?? null;
}

export function getPersistedRefreshToken(): string | null {
  return readPersistedState()?.refreshToken ?? null;
}

export function persistSession(session: AuthSessionResponse): void {
  useAuthStore.getState().setSession(session);
}

export function clearPersistedSession(): void {
  useAuthStore.getState().clearSession();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setSession: (session) =>
        set({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          user: session.user,
          isAuthenticated: true,
        }),

      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(safeSessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
