import { env } from "@/lib/env";
import type { ProblemDetail } from "@/types";

/* Lightweight typed fetch wrapper for backend communication. */

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: ProblemDetail,
  ) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
  }
}

/* Build full URL from a relative path. */
function url(path: string): string {
  return `${env.apiBaseUrl}${path}`;
}

/* Generic JSON request helper. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(path), {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  /* Phase 8: log X-Request-Id from backend for cross-service correlation */
  const requestId = res.headers.get("X-Request-Id");
  if (requestId && typeof window !== "undefined") {
    console.debug(`[CLEO] X-Request-Id: ${requestId} — ${init?.method ?? "GET"} ${path} ${res.status}`);
  }

  if (!res.ok) {
    const problem: ProblemDetail = await res.json().catch(() => ({
      type: `https://httpstatuses.com/${res.status}`,
      title: res.statusText,
      status: res.status,
    }));
    throw new ApiError(res.status, problem);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { headers }),

  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  /* Return raw Response for SSE streaming. */
  stream: (path: string, body: unknown, signal?: AbortSignal) =>
    fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
};
