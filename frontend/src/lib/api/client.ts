import { env } from "@/lib/env";
import {
  clearPersistedSession,
  getPersistedAccessToken,
  getPersistedRefreshToken,
  persistSession,
} from "@/domains/auth/model";
import type { AuthSessionResponse, ProblemDetail } from "@/types";

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

const REFRESH_PATH = "/api/v1/auth/refresh";
let refreshInFlight: Promise<string | null> | null = null;

function shouldAttemptRefresh(path: string): boolean {
  return ![
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
  ].includes(path);
}

async function parseProblem(res: Response): Promise<ProblemDetail> {
  return res.json().catch(() => ({
    type: `https://httpstatuses.com/${res.status}`,
    title: res.statusText,
    status: res.status,
  }));
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getPersistedRefreshToken();
  if (!refreshToken) {
    clearPersistedSession();
    return null;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const res = await fetch(url(REFRESH_PATH), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearPersistedSession();
      return null;
    }

    const session = (await res.json()) as AuthSessionResponse;
    persistSession(session);
    return session.access_token;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

interface RequestOptions {
  allowRefresh?: boolean;
  accessTokenOverride?: string | null;
}

/* Generic JSON request helper. */
async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const accessToken = options?.accessTokenOverride ?? getPersistedAccessToken();
  const { headers: initHeaders, ...restInit } = init ?? {};
  const res = await fetch(url(path), {
    ...restInit,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(initHeaders ?? {}),
    },
  });

  /* Phase 8: log X-Request-Id from backend for cross-service correlation */
  const requestId = res.headers?.get?.("X-Request-Id") ?? null;
  if (requestId && typeof window !== "undefined") {
    console.debug(`[CLEO] X-Request-Id: ${requestId} — ${init?.method ?? "GET"} ${path} ${res.status}`);
  }

  if (!res.ok) {
    if (res.status === 401 && options?.allowRefresh !== false && shouldAttemptRefresh(path)) {
      const refreshedAccessToken = await refreshAccessToken();
      if (refreshedAccessToken) {
        return request<T>(path, init, {
          allowRefresh: false,
          accessTokenOverride: refreshedAccessToken,
        });
      }
    }

    const problem = await parseProblem(res);
    throw new ApiError(res.status, problem);
  }

  if (res.status === 204) {
    return undefined as T;
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

  delete: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "DELETE", headers }),

  /* Return raw Response for SSE streaming. */
  stream: async (path: string, body: unknown, signal?: AbortSignal) => {
    const makeRequest = (accessToken: string | null) =>
      fetch(url(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });

    let accessToken = getPersistedAccessToken();
    let res = await makeRequest(accessToken);

    if (res.status === 401 && shouldAttemptRefresh(path)) {
      accessToken = await refreshAccessToken();
      if (accessToken) {
        res = await makeRequest(accessToken);
      }
    }

    return res;
  },
};
