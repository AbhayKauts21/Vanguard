"use client";

import { useEffect, useRef, useCallback } from "react";
import { useVoiceStore } from "@/domains/voice/model";
import { STTEngine, isSpeechRecognitionSupported } from "@/domains/voice/engine";
import { env } from "@/lib/env";
import type { STTResult } from "@/domains/voice/model/types";

/**
 * Hook wrapping the STT engine with React lifecycle management.
 *
 * Manages:
 * - Engine instantiation and cleanup
 * - Browser support detection
 * - Interim/final transcript updates to voice store
 * - Error handling and auto-recovery
 */
export function useSpeechRecognition() {
  const engineRef = useRef<STTEngine | null>(null);
  const seedTranscriptRef = useRef("");
  const setUserTranscript = useVoiceStore((s) => s.setUserTranscript);
  const setFinalTranscript = useVoiceStore((s) => s.setFinalTranscript);
  const setError = useVoiceStore((s) => s.setError);
  const setSupported = useVoiceStore((s) => s.setSupported);

  const normalizeTranscript = useCallback((transcript: string): string => {
    return transcript.replace(/\s+/g, " ").trim();
  }, []);

  const mergeSeedTranscript = useCallback(
    (transcript: string): string => {
      const seed = normalizeTranscript(seedTranscriptRef.current);
      const incoming = normalizeTranscript(transcript);

      if (!seed) {
        return incoming;
      }

      if (!incoming) {
        return seed;
      }

      const seedLower = seed.toLowerCase();
      const incomingLower = incoming.toLowerCase();

      if (incomingLower.startsWith(seedLower)) {
        return incoming;
      }

      if (seedLower.startsWith(incomingLower)) {
        return seed;
      }

      const seedWords = seed.split(" ");
      const incomingWords = incoming.split(" ");
      const maxOverlap = Math.min(seedWords.length, incomingWords.length);

      for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
        const seedSuffix = seedWords
          .slice(seedWords.length - overlap)
          .join(" ")
          .toLowerCase();
        const incomingPrefix = incomingWords.slice(0, overlap).join(" ").toLowerCase();

        if (seedSuffix === incomingPrefix) {
          return [...seedWords, ...incomingWords.slice(overlap)].join(" ").trim();
        }
      }

      return `${seed} ${incoming}`.trim();
    },
    [normalizeTranscript],
  );

  // Check browser support on mount
  useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    setSupported(supported);
  }, [setSupported]);

  const start = useCallback((options?: { seedTranscript?: string }) => {
    if (!isSpeechRecognitionSupported()) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }

    seedTranscriptRef.current = normalizeTranscript(options?.seedTranscript ?? "");

    if (seedTranscriptRef.current) {
      setUserTranscript(seedTranscriptRef.current);
      setFinalTranscript(seedTranscriptRef.current);
    }

    // Create a fresh engine per session
    const engine = new STTEngine({
      language: env.voice.sttLanguage,
      continuous: true,
      interimResults: true,
    });

    engineRef.current = engine;

    engine.start({
      onResult: (result: STTResult) => {
        // Guard: ignore results if not in listening phase to prevent "hallucinations"
        const state = useVoiceStore.getState();
        if (state.phase !== "listening") return;

        const mergedTranscript = mergeSeedTranscript(result.transcript);
        setUserTranscript(mergedTranscript);

        if (result.isFinal) {
          setFinalTranscript(mergedTranscript);
        }
      },
      onError: (error: string) => {
        setError(error);
      },
      onEnd: () => {
        // STT ended (might be auto-restart via engine)
      },
      onStart: () => {
        setError(null);
      },
    });
  }, [
    mergeSeedTranscript,
    normalizeTranscript,
    setError,
    setFinalTranscript,
    setUserTranscript,
  ]);

  const stop = useCallback((): string => {
    const engine = engineRef.current;
    if (!engine) {
      const transcript = mergeSeedTranscript("");
      seedTranscriptRef.current = "";
      return transcript;
    }

    const transcript = mergeSeedTranscript(engine.stop());
    engineRef.current = null;
    seedTranscriptRef.current = "";
    return transcript;
  }, [mergeSeedTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
      seedTranscriptRef.current = "";
    };
  }, []);

  return { start, stop };
}
