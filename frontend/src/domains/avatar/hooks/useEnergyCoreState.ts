"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChatStore } from "@/domains/chat/model";
import { useAvatarStore } from "../model/avatar-store";
import { deriveEnergyCoreState, type EnergyCoreVisualState } from "../model/energy-core";

export const ENERGY_CORE_SPEECH_HOLD_MS = 6000;

/**
 * Keeps the energy core in speech mode briefly after an answer lands so the UI
 * retains the same response cadence as the Stitch prototype.
 */
export function useEnergyCoreState(): EnergyCoreVisualState {
  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const avatarState = useAvatarStore((s) => s.currentState);

  const [speechHoldUntil, setSpeechHoldUntil] = useState<number | null>(null);
  const previousAssistantSignatureRef = useRef<string | null>(null);

  const latestAssistant = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") {
        return message;
      }
    }

    return null;
  }, [messages]);

  useEffect(() => {
    if (!latestAssistant || !latestAssistant.content.trim()) {
      return;
    }

    const signature = `${latestAssistant.id}:${latestAssistant.isStreaming ? "1" : "0"}:${latestAssistant.content.length}`;
    const previousSignature = previousAssistantSignatureRef.current;
    const finishedStreaming =
      previousSignature !== null &&
      previousSignature.startsWith(`${latestAssistant.id}:1:`) &&
      signature.startsWith(`${latestAssistant.id}:0:`);
    const addedCompletedResponse =
      previousSignature === null || !previousSignature.startsWith(`${latestAssistant.id}:`);

    if (!latestAssistant.isStreaming && (finishedStreaming || addedCompletedResponse)) {
      setSpeechHoldUntil(Date.now() + ENERGY_CORE_SPEECH_HOLD_MS);
    }

    previousAssistantSignatureRef.current = signature;
  }, [latestAssistant]);

  useEffect(() => {
    if (!speechHoldUntil) {
      return;
    }

    const remainingMs = speechHoldUntil - Date.now();
    if (remainingMs <= 0) {
      setSpeechHoldUntil(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSpeechHoldUntil(null);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [speechHoldUntil]);

  return deriveEnergyCoreState({
    avatarState,
    isThinking,
    hasStreamingMessage: Boolean(streamingMessageId),
    hasSpeechHold: speechHoldUntil !== null && speechHoldUntil > Date.now(),
  });
}
