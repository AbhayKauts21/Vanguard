/**
 * Avatar API client — server-side token proxy for HeyGen.
 *
 * The HeyGen API key lives on the server (Next.js route handler at
 * /api/heygen/token).  This module wraps the fetch so the hook stays
 * clean and testable.
 */

import type { HeyGenTokenResponse } from "../model/types";

const HEYGEN_TOKEN_ENDPOINT = "/api/heygen/token";

/**
 * Request a short-lived HeyGen streaming session token.
 * The actual API key never leaves the server.
 */
export async function fetchHeyGenToken(): Promise<string> {
  const res = await fetch(HEYGEN_TOKEN_ENDPOINT, { method: "POST" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HeyGen token request failed (${res.status}): ${body}`);
  }

  const data: HeyGenTokenResponse = await res.json();

  if (!data.token) {
    throw new Error("HeyGen token response missing 'token' field");
  }

  return data.token;
}
