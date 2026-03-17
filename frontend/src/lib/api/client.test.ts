import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "@/lib/api/client";

/* Mock global fetch. */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("api client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
});
