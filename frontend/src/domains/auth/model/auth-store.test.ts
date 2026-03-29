import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSessionResponse } from "@/types";
import {
  AUTH_STORAGE_KEY,
  getPersistedAccessToken,
  getPersistedRefreshToken,
  persistSession,
  useAuthStore,
} from "./auth-store";

describe("useAuthStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.getState().clearSession();
  });

  it("starts unauthenticated", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it("stores a session response", () => {
    const session: AuthSessionResponse = {
      access_token: "access-123",
      refresh_token: "refresh-123",
      token_type: "bearer",
      access_token_expires_in: 1800,
      refresh_token_expires_in: 1209600,
      user: {
        id: "user-1",
        email: "user@example.com",
        full_name: "User Example",
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: null,
        roles: [],
        permissions: [],
      },
    };

    useAuthStore.getState().setSession(session);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("access-123");
    expect(state.refreshToken).toBe("refresh-123");
    expect(state.user?.email).toBe("user@example.com");
  });

  it("clears the stored session", () => {
    useAuthStore.getState().setSession({
      access_token: "access-123",
      refresh_token: "refresh-123",
      token_type: "bearer",
      access_token_expires_in: 1800,
      refresh_token_expires_in: 1209600,
      user: {
        id: "user-1",
        email: "user@example.com",
        full_name: "User Example",
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: null,
        roles: [],
        permissions: [],
      },
    });

    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it("reads persisted access and refresh tokens from session storage", () => {
    persistSession({
      access_token: "access-456",
      refresh_token: "refresh-456",
      token_type: "bearer",
      access_token_expires_in: 1800,
      refresh_token_expires_in: 1209600,
      user: {
        id: "user-2",
        email: "persisted@example.com",
        full_name: "Persisted User",
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: null,
        roles: [],
        permissions: [],
      },
    });

    expect(getPersistedAccessToken()).toBe("access-456");
    expect(getPersistedRefreshToken()).toBe("refresh-456");
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toContain("access-456");
  });
});
