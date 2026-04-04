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
  const setUserTranscript = useVoiceStore((s) => s.setUserTranscript);
  const setFinalTranscript = useVoiceStore((s) => s.setFinalTranscript);
  const setError = useVoiceStore((s) => s.setError);
  const setSupported = useVoiceStore((s) => s.setSupported);

  // Check browser support on mount
  useEffect(() => {
    const supported = isSpeechRecognitionSupported();
    setSupported(supported);
  }, [setSupported]);

  const start = useCallback((onSpeechStart?: () => void) => {
    if (!isSpeechRecognitionSupported()) {
      setError("Speech recognition is not supported in this browser.");
      return;
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

        setUserTranscript(result.transcript);

        if (result.isFinal) {
          setFinalTranscript(result.transcript);
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
      onSpeechStart,
    });
  }, [setUserTranscript, setFinalTranscript, setError]);

  const stop = useCallback((): string => {
    const engine = engineRef.current;
    if (!engine) return "";

    const transcript = engine.stop();
    engineRef.current = null;
    return transcript;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  return { start, stop };
}
