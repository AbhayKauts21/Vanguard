import { describe, it, expect } from "vitest";
import {
  LOCALES,
  DEFAULT_LOCALE,
  API_V1,
  CHAT_ENDPOINT,
  CHAT_STREAM_ENDPOINT,
  HEALTH_ENDPOINT,
  SSE_TOKEN_EVENT,
  SSE_DONE_EVENT,
} from "@/lib/constants";

describe("constants", () => {
  it("defines supported locales", () => {
    expect(LOCALES).toContain("en");
    expect(LOCALES).toContain("es");
  });

  it("defaults to english", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("defines correct API endpoints", () => {
    expect(API_V1).toBe("/api/v1");
    expect(CHAT_ENDPOINT).toBe("/api/v1/chat");
    expect(CHAT_STREAM_ENDPOINT).toBe("/api/v1/chat/stream");
    expect(HEALTH_ENDPOINT).toBe("/health");
  });

  it("defines SSE event type constants", () => {
    expect(SSE_TOKEN_EVENT).toBe("token");
    expect(SSE_DONE_EVENT).toBe("done");
  });
});
