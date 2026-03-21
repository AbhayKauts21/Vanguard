import { describe, it, expect } from "vitest";
import { parseSSELine } from "@/lib/api/sse-parser";

describe("parseSSELine", () => {
  it("parses a token event", () => {
    const result = parseSSELine('data: {"type":"token","content":"Hello"}');
    expect(result).toEqual({ type: "token", content: "Hello" });
  });

  it("parses a done event with citations", () => {
    const line =
      'data: {"type":"done","citations":[{"page_id":1,"page_title":"Test","source_url":"http://example.com","source_type":"bookstack","source_name":"Test Book","chunk_text":"...","score":0.95}]}';
    const result = parseSSELine(line);
    expect(result).toEqual({
      type: "done",
      citations: [
        { page_id: 1, page_title: "Test", source_url: "http://example.com", source_type: "bookstack", source_name: "Test Book", chunk_text: "...", score: 0.95 },
      ],
    });
  });

  it("returns null for empty lines", () => {
    expect(parseSSELine("")).toBeNull();
    expect(parseSSELine("  ")).toBeNull();
  });

  it("returns null for non-data lines", () => {
    expect(parseSSELine("event: message")).toBeNull();
    expect(parseSSELine(": comment")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseSSELine("data: {invalid}")).toBeNull();
  });

  it("handles data: with no payload", () => {
    expect(parseSSELine("data:")).toBeNull();
    expect(parseSSELine("data: ")).toBeNull();
  });
});
