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
  let onVoiceReady: (event: SSEEvent & { type: "voice_ready" }) => void;

  beforeEach(() => {
    onToken = vi.fn();
    onDone = vi.fn();
    onError = vi.fn();
    onVoiceReady = vi.fn();
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

  it("surfaces voice_ready events before done", async () => {
    const response = mockStreamResponse([
      'data: {"type":"voice_ready","voice_response":"Short answer.","voice_audio_base64":"YXVkaW8=","voice_audio_content_type":"audio/mpeg"}\n\n',
      'data: {"type":"token","content":"Full answer."}\n\n',
      'data: {"type":"done","primary_citations":[],"secondary_citations":[],"all_citations":[],"hidden_sources_count":0,"mode_used":"rag","max_confidence":0.91,"voice_response":"Short answer."}\n\n',
    ]);

    await consumeSSEStream(response, onToken, onDone, onError, onVoiceReady);

    expect(onVoiceReady).toHaveBeenCalledWith({
      type: "voice_ready",
      voice_response: "Short answer.",
      voice_audio_base64: "YXVkaW8=",
      voice_audio_content_type: "audio/mpeg",
    });
    expect(onToken).toHaveBeenCalledWith("Full answer.");
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
