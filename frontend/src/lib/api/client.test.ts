import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUTH_STORAGE_KEY } from "@/domains/auth/model";
import { api, ApiError } from "@/lib/api/client";

/* Mock global fetch. */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("api client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    sessionStorage.clear();
  });

  it("api.get sends GET and parses JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });

    const result = await api.get("/health");
    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("api.post sends POST with JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ answer: "test" }),
    });

    const result = await api.post("/api/v1/chat/", { message: "hi" });
    expect(result).toEqual({ answer: "test" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/chat/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "hi" }),
      }),
    );
  });

  it("throws ApiError on non-ok response with RFC 7807 body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () =>
        Promise.resolve({
          type: "https://httpstatuses.com/404",
          title: "Not Found",
          detail: "No relevant docs",
          status: 404,
        }),
    });

    try {
      await api.get("/test");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
      expect((e as ApiError).message).toBe("No relevant docs");
    }
  });

  it("handles non-JSON error response gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(api.get("/fail")).rejects.toThrow(ApiError);
  });

  it("api.stream returns raw Response", async () => {
    const fakeResponse = { ok: true, body: {} };
    mockFetch.mockResolvedValueOnce(fakeResponse);

    const result = await api.stream("/api/v1/chat/stream", { message: "hi" });
    expect(result).toBe(fakeResponse);
  });

  it("attaches bearer token when an auth session is present", async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ state: { accessToken: "token-123" } }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok" }),
    });

    await api.get("/health");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      }),
    );
  });

  it("api.post with no body sends undefined body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api.post("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "POST", body: undefined }),
    );
  });

  it("refreshes the access token and retries once on 401", async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        state: {
          accessToken: "expired-access",
          refreshToken: "refresh-123",
          user: null,
          isAuthenticated: true,
        },
      }),
    );

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            type: "https://httpstatuses.com/401",
            title: "Unauthorized",
            detail: "Invalid or expired token.",
            status: 401,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access",
            refresh_token: "new-refresh",
            token_type: "bearer",
            access_token_expires_in: 1800,
            refresh_token_expires_in: 1209600,
            user: {
              id: "user-1",
              email: "admin@example.com",
              full_name: "Admin",
              is_active: true,
              created_at: new Date().toISOString(),
              last_login_at: null,
              roles: [],
              permissions: [],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

    const result = await api.get("/api/v1/admin/sync/status");

    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/v1/auth/refresh"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "refresh-123" }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/api/v1/admin/sync/status"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer new-access",
        }),
      }),
    );
  });

  it("clears the session when refresh fails", async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        state: {
          accessToken: "expired-access",
          refreshToken: "refresh-123",
          user: null,
          isAuthenticated: true,
        },
      }),
    );

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            type: "https://httpstatuses.com/401",
            title: "Unauthorized",
            detail: "Invalid or expired token.",
            status: 401,
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            type: "https://httpstatuses.com/401",
            title: "Unauthorized",
            detail: "Refresh token expired.",
            status: 401,
          }),
      });

    await expect(api.get("/api/v1/admin/sync/status")).rejects.toThrow(ApiError);

    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    expect(stored).toContain("\"accessToken\":null");
    expect(stored).toContain("\"refreshToken\":null");
  });
});
