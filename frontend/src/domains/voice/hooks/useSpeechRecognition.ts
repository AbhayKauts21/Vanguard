"use client";

import { useEffect, useRef, useCallback } from "react";
import { useVoiceStore } from "@/domains/voice/model";
import { STTEngine, isSpeechRecognitionSupported } from "@/domains/voice/engine";
import { env } from "@/lib/env";
import type { STTResult } from "@/domains/voice/model/types";

/**
 * Manages the STT engine lifecycle.
 */
export function useSpeechRecognition() {
  const engineRef = useRef<STTEngine | null>(null);
  const setUserTranscript = useVoiceStore((s) => s.setUserTranscript);
  const setFinalTranscript = useVoiceStore((s) => s.setFinalTranscript);
  const setError = useVoiceStore((s) => s.setError);
  const setSupported = useVoiceStore((s) => s.setSupported);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, [setSupported]);

  const start = useCallback((onSpeechStart?: () => void) => {
    const engine = new STTEngine({
      language: env.voice.sttLanguage,
      continuous: true,
      interimResults: true,
    });

    engineRef.current = engine;

    engine.start({
      onResult: (result: STTResult) => {
        setUserTranscript(result.transcript);
        if (result.isFinal) setFinalTranscript(result.transcript);
      },
      onError: (err: string) => setError(err),
      onStart: () => setError(null),
      onEnd: () => {},
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

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  return { start, stop };
}
