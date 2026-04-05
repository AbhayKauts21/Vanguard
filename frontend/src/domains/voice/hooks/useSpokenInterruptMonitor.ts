"use client";

import { useEffect, useRef } from "react";
import { STTEngine, isSpeechRecognitionSupported } from "@/domains/voice/engine";
import { isInterruptIntent, normalizeInterruptTranscript } from "@/domains/voice/model/interrupt-intent";
import { env } from "@/lib/env";

interface TranscriptBuffer {
  raw: string;
  normalized: string;
  firstSeenAt: number;
}

interface UseSpokenInterruptMonitorOptions {
  active: boolean;
  speaking: boolean;
  getSpokenText: () => string;
  getSpeechDetectedAt: () => number;
  onTranscriptCandidate?: (transcript: string) => void;
  onInterruptIntent: (seedTranscript: string) => void;
}

const SPEECH_GATE_WINDOW_MS = 4000;

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isSameUtterance(current: string, previous: string): boolean {
  return (
    current === previous ||
    current.startsWith(previous) ||
    previous.startsWith(current)
  );
}

export function useSpokenInterruptMonitor({
  active,
  speaking,
  getSpokenText,
  getSpeechDetectedAt,
  onTranscriptCandidate,
  onInterruptIntent,
}: UseSpokenInterruptMonitorOptions) {
  const engineRef = useRef<STTEngine | null>(null);
  const getSpokenTextRef = useRef(getSpokenText);
  const getSpeechDetectedAtRef = useRef(getSpeechDetectedAt);
  const onTranscriptCandidateRef = useRef(onTranscriptCandidate);
  const onInterruptIntentRef = useRef(onInterruptIntent);
  const transcriptBufferRef = useRef<TranscriptBuffer | null>(null);

  useEffect(() => {
    getSpokenTextRef.current = getSpokenText;
  }, [getSpokenText]);

  useEffect(() => {
    getSpeechDetectedAtRef.current = getSpeechDetectedAt;
  }, [getSpeechDetectedAt]);

  useEffect(() => {
    onTranscriptCandidateRef.current = onTranscriptCandidate;
  }, [onTranscriptCandidate]);

  useEffect(() => {
    onInterruptIntentRef.current = onInterruptIntent;
  }, [onInterruptIntent]);

  useEffect(() => {
    if (!active || !speaking || !isSpeechRecognitionSupported()) {
      transcriptBufferRef.current = null;
      onTranscriptCandidateRef.current?.("");
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }

    const engine = new STTEngine({
      language: env.voice.sttLanguage,
      continuous: true,
      interimResults: true,
    });

    engineRef.current = engine;
    let isDisposed = false;

    const stopEngine = () => {
      transcriptBufferRef.current = null;
      onTranscriptCandidateRef.current?.("");
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      try {
        engine.stop();
      } catch {
        // Best-effort cleanup.
      }
    };

    engine.start({
      onStart: () => {
        transcriptBufferRef.current = null;
        onTranscriptCandidateRef.current?.("");
      },
      onEnd: () => {
        if (isDisposed && engineRef.current === engine) {
          engineRef.current = null;
        }
      },
      onError: (error) => {
        console.warn("[VoiceMode] Spoken interrupt monitor unavailable:", error);
        stopEngine();
      },
      onResult: (result) => {
        const now = performance.now();
        if (now - getSpeechDetectedAtRef.current() > SPEECH_GATE_WINDOW_MS) {
          return;
        }

        const rawTranscript = compactWhitespace(result.transcript);
        const normalizedTranscript = normalizeInterruptTranscript(rawTranscript);

        if (!normalizedTranscript) {
          onTranscriptCandidateRef.current?.("");
          return;
        }

        onTranscriptCandidateRef.current?.(rawTranscript);

        const previous = transcriptBufferRef.current;
        const firstSeenAt =
          previous && isSameUtterance(normalizedTranscript, previous.normalized)
            ? previous.firstSeenAt
            : now;

        transcriptBufferRef.current = {
          raw: rawTranscript,
          normalized: normalizedTranscript,
          firstSeenAt,
        };

        const stableMs = now - firstSeenAt;
        if (
          isInterruptIntent({
            transcript: rawTranscript,
            spokenText: getSpokenTextRef.current(),
            isFinal: result.isFinal,
            stableMs,
          })
        ) {
          stopEngine();
          onInterruptIntentRef.current(rawTranscript);
        }
      },
    });

    return () => {
      isDisposed = true;
      stopEngine();
    };
  }, [active, speaking]);
}
