/**
 * STT Engine — Web Speech API implementation.
 *
 * Provides a clean abstraction over the browser's SpeechRecognition API.
 * Designed for easy swap to Azure Speech SDK in the future by implementing
 * the same start/stop/callbacks interface.
 *
 * Key behaviors:
 * - Continuous mode: keeps listening until explicitly stopped
 * - Interim results: delivers partial transcripts for live typewriter display
 * - Auto-restart: handles the browser's tendency to stop recognition on silence
 * - Cleanup: safely disposes on stop() to prevent memory leaks
 */

import type { STTConfig, STTEngineCallbacks } from "@/domains/voice/model/types";

/** Default STT configuration for English voice mode. */
export const DEFAULT_STT_CONFIG: STTConfig = {
  language: "en-US",
  continuous: true,
  interimResults: true,
};

/**
 * Check if the browser supports the Web Speech API SpeechRecognition.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    window.SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition
  );
}

/**
 * Get the SpeechRecognition constructor (with vendor prefix fallback).
 */
function getSpeechRecognitionCtor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return (
    window.SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition })
      .webkitSpeechRecognition ||
    null
  );
}

export class STTEngine {
  private recognition: SpeechRecognition | null = null;
  private config: STTConfig;
  private callbacks: STTEngineCallbacks | null = null;
  private isRunning = false;
  private shouldRestart = false;

  /** Accumulated final transcript across recognition restarts. */
  private accumulatedTranscript = "";

  constructor(config: Partial<STTConfig> = {}) {
    this.config = { ...DEFAULT_STT_CONFIG, ...config };
  }

  /** True if the engine is currently listening. */
  get active(): boolean {
    return this.isRunning;
  }

  /**
   * Start listening with the provided callbacks.
   * Throws if browser doesn't support SpeechRecognition.
   */
  start(callbacks: STTEngineCallbacks): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      callbacks.onError("Speech recognition is not supported in this browser.");
      return;
    }

    // Clean up any previous instance
    this.stop();

    this.callbacks = callbacks;
    this.accumulatedTranscript = "";
    this.shouldRestart = true;

    const recognition = new Ctor();
    recognition.lang = this.config.language;
    recognition.continuous = this.config.continuous;
    recognition.interimResults = this.config.interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isRunning = true;
      this.callbacks?.onStart();
    };

    recognition.onspeechstart = () => {
      this.callbacks?.onSpeechStart?.();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalSegment = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalSegment += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Accumulate final segments across recognition restarts
      if (finalSegment) {
        this.accumulatedTranscript = this.accumulatedTranscript
          ? `${this.accumulatedTranscript} ${finalSegment.trim()}`
          : finalSegment.trim();
      }

      // Report the combined transcript: accumulated finals + current interim
      const fullTranscript = interimTranscript
        ? `${this.accumulatedTranscript} ${interimTranscript}`.trim()
        : this.accumulatedTranscript;

      this.callbacks?.onResult({
        transcript: fullTranscript,
        isFinal: !!finalSegment && !interimTranscript,
        confidence: finalSegment
          ? event.results[event.results.length - 1]?.[0]?.confidence ?? 0
          : 0,
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are non-fatal — user just didn't speak yet
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      this.isRunning = false;
      this.shouldRestart = false;
      this.callbacks?.onError(this.humanizeError(event.error));
    };

    recognition.onend = () => {
      this.isRunning = false;

      // Auto-restart in continuous mode (browser stops on silence)
      if (this.shouldRestart && this.config.continuous) {
        try {
          recognition.start();
        } catch {
          // Already started or disposed — safe to ignore
          this.callbacks?.onEnd();
        }
        return;
      }

      this.callbacks?.onEnd();
    };

    try {
      recognition.start();
      this.recognition = recognition;
    } catch (err) {
      this.callbacks?.onError(
        err instanceof Error ? err.message : "Failed to start speech recognition.",
      );
    }
  }

  /**
   * Stop listening and return the accumulated final transcript.
   */
  stop(): string {
    this.shouldRestart = false;
    this.isRunning = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Already stopped — safe to ignore
      }
      this.recognition = null;
    }

    const finalText = this.accumulatedTranscript.trim();
    this.callbacks = null;
    return finalText;
  }

  /**
   * Get the current accumulated final transcript without stopping.
   */
  getTranscript(): string {
    return this.accumulatedTranscript.trim();
  }
  
  /**
   * Reset the engine state, clearing any buffered transcripts.
   */
  reset(): void {
    this.accumulatedTranscript = "";
  }

  /**
   * Update the language at runtime (e.g. locale switch).
   */
  setLanguage(language: string): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  /**
   * Map raw SpeechRecognitionErrorEvent error codes to user-friendly messages.
   */
  private humanizeError(code: string): string {
    switch (code) {
      case "not-allowed":
        return "Microphone access was denied. Please allow microphone permissions.";
      case "audio-capture":
        return "No microphone detected. Please connect a microphone.";
      case "network":
        return "Network error during speech recognition. Check your connection.";
      case "service-not-allowed":
        return "Speech recognition service is not available.";
      case "language-not-supported":
        return "The selected language is not supported for speech recognition.";
      default:
        return `Speech recognition error: ${code}`;
    }
  }
}
