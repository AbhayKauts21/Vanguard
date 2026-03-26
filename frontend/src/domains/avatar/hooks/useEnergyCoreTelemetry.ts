"use client";

import { useMemo } from "react";
import { useChatStore } from "@/domains/chat/model";
import { deriveEnergyCoreTelemetry } from "../model/energy-core-telemetry";

export function useEnergyCoreTelemetry() {
  const messages = useChatStore((state) => state.messages);
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);

  return useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") {
        continue;
      }

      return deriveEnergyCoreTelemetry({
        modeUsed: message.modeUsed,
        maxConfidence: message.maxConfidence,
        isStreaming: message.id === streamingMessageId || message.isStreaming,
        contentLength: message.content.length,
        primaryCitations: message.primary_citations,
        secondaryCitations: message.secondary_citations,
        allCitations: message.all_citations,
      });
    }

    return deriveEnergyCoreTelemetry({});
  }, [messages, streamingMessageId]);
}
