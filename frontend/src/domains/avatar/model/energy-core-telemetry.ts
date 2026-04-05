import type { Citation } from "@/types";

export type EnergyCoreKnowledgeMode = "idle" | "grounded" | "uncertain" | "fallback";

export interface EnergyCoreTelemetryInput {
  modeUsed?: "rag" | "uncertain" | "azure_fallback" | "shortcut";
  maxConfidence?: number;
  isStreaming?: boolean;
  contentLength?: number;
  primaryCitations?: Citation[];
  secondaryCitations?: Citation[];
  allCitations?: Citation[];
}

export interface EnergyCoreSourceNode {
  id: string;
  pageId: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  snippet: string;
  score: number;
  tier: "primary" | "secondary" | "tertiary";
  orbitAngle: number;
  radius: number;
}

export interface EnergyCoreTelemetrySnapshot {
  mode: EnergyCoreKnowledgeMode;
  confidence: number;
  isStreaming: boolean;
  tokenCount: number;
  streamPulse: number;
  sourceNodes: EnergyCoreSourceNode[];
}

const ORBIT_LAYOUT = [
  { orbitAngle: -30, radius: 214 },
  { orbitAngle: 34, radius: 236 },
  { orbitAngle: 142, radius: 222 },
  { orbitAngle: 216, radius: 228 },
] as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(value, 1));
}

function normalizeCitations(
  primary: Citation[],
  secondary: Citation[],
  all: Citation[],
): EnergyCoreSourceNode[] {
  const tiers = [
    { citations: primary, tier: "primary" as const },
    { citations: secondary, tier: "secondary" as const },
    { citations: all, tier: "tertiary" as const },
  ];
  const seen = new Set<number>();
  const nodes: EnergyCoreSourceNode[] = [];

  for (const { citations, tier } of tiers) {
    for (const citation of citations) {
      if (seen.has(citation.page_id)) {
        continue;
      }

      seen.add(citation.page_id);
      nodes.push({
        id: `${tier}-${citation.page_id}`,
        pageId: citation.page_id,
        title: citation.page_title,
        sourceName: citation.source_name,
        sourceUrl: citation.source_url,
        snippet: citation.chunk_text,
        score: clamp01(citation.score || 0),
        tier,
        orbitAngle: 0,
        radius: 0,
      });
    }
  }

  return nodes.slice(0, ORBIT_LAYOUT.length).map((node, index) => ({
    ...node,
    orbitAngle: ORBIT_LAYOUT[index]?.orbitAngle ?? 0,
    radius: ORBIT_LAYOUT[index]?.radius ?? 220,
  }));
}

function deriveMode({
  modeUsed,
  sourceCount,
}: {
  modeUsed?: EnergyCoreTelemetryInput["modeUsed"];
  sourceCount: number;
}): EnergyCoreKnowledgeMode {
  if (modeUsed === "azure_fallback") {
    return "fallback";
  }

  if (modeUsed === "uncertain") {
    return "uncertain";
  }

  if (modeUsed === "rag" || modeUsed === "shortcut" || sourceCount > 0) {
    return "grounded";
  }

  return "idle";
}

function deriveConfidence({
  mode,
  rawConfidence,
  sourceNodes,
}: {
  mode: EnergyCoreKnowledgeMode;
  rawConfidence?: number;
  sourceNodes: EnergyCoreSourceNode[];
}) {
  if (typeof rawConfidence === "number" && rawConfidence > 0) {
    return clamp01(rawConfidence);
  }

  if (sourceNodes.length > 0) {
    return clamp01(sourceNodes[0].score || 0.74);
  }

  switch (mode) {
    case "grounded":
      return 0.72;
    case "uncertain":
      return 0.42;
    case "fallback":
      return 0.18;
    default:
      return 0.22;
  }
}

export function deriveEnergyCoreTelemetry(
  input: EnergyCoreTelemetryInput,
): EnergyCoreTelemetrySnapshot {
  const sourceNodes = normalizeCitations(
    input.primaryCitations ?? [],
    input.secondaryCitations ?? [],
    input.allCitations ?? [],
  );
  const mode = deriveMode({
    modeUsed: input.modeUsed,
    sourceCount: sourceNodes.length,
  });
  const confidence = deriveConfidence({
    mode,
    rawConfidence: input.maxConfidence,
    sourceNodes,
  });
  const tokenCount = input.isStreaming ? input.contentLength ?? 0 : 0;
  const streamPulse = input.isStreaming
    ? clamp01(0.28 + Math.min(tokenCount, 320) / 320)
    : 0;

  return {
    mode,
    confidence,
    isStreaming: Boolean(input.isStreaming),
    tokenCount,
    streamPulse,
    sourceNodes,
  };
}
