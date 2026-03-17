import { describe, it, expect, vi, beforeEach } from "vitest";
import { consumeSSEStream } from "@/lib/api/sse-parser";
import type { SSEEvent } from "@/types";

/* Helper to create a mock ReadableStream from text chunks. */
function mockStreamResponse(chunks: string[], ok = true): Response {
  let idx = 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(encoder.encode(chunks[idx]));
        idx++;
      } else {
        controller.close();
      }
    },
  });

  return { ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "Error", body: stream } as unknown as Response;
}

describe("consumeSSEStream", () => {
  let onToken: (content: string) => void;
  let onDone: (event: SSEEvent & { type: "done" }) => void;
  let onError: (error: Error) => void;

  beforeEach(() => {
    onToken = vi.fn();
    onDone = vi.fn();
    onError = vi.fn();
  });

  it("parses token events from stream", async () => {
    const response = mockStreamResponse([
      'data: {"type":"token","content":"Hello"}\n\n',
      'data: {"type":"token","content":" world"}\n\n',
      'data: {"type":"done","citations":[]}\n\n',
    ]);

    await consumeSSEStream(response, onToken, onDone, onError);

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenCalledWith("Hello");
    expect(onToken).toHaveBeenCalledWith(" world");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("handles non-ok response", async () => {
    const response = mockStreamResponse([], false);

    await consumeSSEStream(response, onToken, onDone, onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onToken).not.toHaveBeenCalled();
  });

  it("handles response with no body", async () => {
    const response = { ok: true, body: null } as unknown as Response;

    await consumeSSEStream(response, onToken, onDone, onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("handles split chunks across boundaries", async () => {
    const response = mockStreamResponse([
      'data: {"type":"tok',
      'en","content":"hi"}\n\n',
    ]);

    await consumeSSEStream(response, onToken, onDone, onError);
    expect(onToken).toHaveBeenCalledWith("hi");
  });
});
