import type { SSEEvent } from "@/types";

/* Parse a single SSE data line into a typed event. */
export function parseSSELine(line: string): SSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) return null;

  const json = trimmed.slice(5).trim();
  if (!json) return null;

  try {
    return JSON.parse(json) as SSEEvent;
  } catch {
    return null;
  }
}

/* Read an SSE stream and invoke callbacks per event type. */
export async function consumeSSEStream(
  response: Response,
  onToken: (content: string) => void,
  onDone: (event: SSEEvent & { type: "done" }) => void,
  onError: (error: Error) => void,
  onVoiceReady?: (event: SSEEvent & { type: "voice_ready" }) => void,
): Promise<void> {
  if (!response.ok) {
    onError(new Error(`Stream failed: ${response.status} ${response.statusText}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError(new Error("No response body stream available."));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      /* Keep the last partial line in the buffer. */
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseSSELine(line);
        if (!event) continue;

        if (event.type === "token") {
          onToken(event.content);
        } else if (event.type === "voice_ready") {
          onVoiceReady?.(event);
        } else if (event.type === "done") {
          onDone(event);
        }
      }
    }

    /* Flush any remaining buffer. */
    if (buffer.trim()) {
      const event = parseSSELine(buffer);
      if (event?.type === "token") onToken(event.content);
      if (event?.type === "voice_ready") onVoiceReady?.(event);
      if (event?.type === "done") onDone(event);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError(err instanceof Error ? err : new Error("Stream read failed."));
  } finally {
    reader.releaseLock();
  }
}
