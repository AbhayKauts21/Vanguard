import { describe, expect, it } from "vitest";
import { deriveEnergyCoreTelemetry } from "./energy-core-telemetry";

const primaryCitation = {
  page_id: 101,
  page_title: "CLEO Architecture",
  source_name: "Architecture Guide",
  source_url: "https://example.com/architecture",
  source_type: "vector",
  chunk_text: "CLEO uses a retrieval layer with Pinecone-backed document grounding.",
  score: 0.92,
};

const secondaryCitation = {
  page_id: 202,
  page_title: "Streaming Responses",
  source_name: "API Guide",
  source_url: "https://example.com/streaming",
  source_type: "vector",
  chunk_text: "Streaming responses are emitted token by token through SSE.",
  score: 0.81,
};

describe("deriveEnergyCoreTelemetry", () => {
  it("derives grounded mode and orbit nodes from citations", () => {
    const result = deriveEnergyCoreTelemetry({
      modeUsed: "rag",
      primaryCitations: [primaryCitation],
      secondaryCitations: [secondaryCitation],
      allCitations: [primaryCitation, secondaryCitation],
    });

    expect(result.mode).toBe("grounded");
    expect(result.confidence).toBe(0.92);
    expect(result.sourceNodes).toHaveLength(2);
    expect(result.sourceNodes[0].title).toBe("CLEO Architecture");
    expect(result.sourceNodes[1].orbitAngle).toBe(34);
  });

  it("derives fallback mode without grounding when azure fallback was used", () => {
    const result = deriveEnergyCoreTelemetry({
      modeUsed: "azure_fallback",
      maxConfidence: 0.12,
    });

    expect(result.mode).toBe("fallback");
    expect(result.confidence).toBe(0.12);
    expect(result.sourceNodes).toEqual([]);
  });

  it("creates a stream pulse while tokens are actively arriving", () => {
    const result = deriveEnergyCoreTelemetry({
      isStreaming: true,
      contentLength: 160,
    });

    expect(result.isStreaming).toBe(true);
    expect(result.tokenCount).toBe(160);
    expect(result.streamPulse).toBeGreaterThan(0.6);
  });
});
