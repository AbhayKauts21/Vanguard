/**
 * Voice domain types — phase lifecycle, configuration, and STT result shapes.
 *
 * Voice mode lifecycle:
 *   idle → session_open → listening → processing → speaking → session_open
 *      \_______________________________________________________________/
 *                                end session
 */

/** Active phase of the voice-to-voice pipeline. */
export type VoicePhase =
  | "idle"
  | "session_open"
  | "listening"
  | "processing"
  | "speaking"
  | "session_closing";

/** A single STT recognition result (interim or final). */
export interface STTResult {
  /** The transcribed text. */
  transcript: string;
  /** True while the recognition engine is still refining this segment. */
  isFinal: boolean;
  /** Browser-reported confidence 0-1 (may be 0 for interim results). */
  confidence: number;
}

/** Configuration for the STT engine abstraction. */
export interface STTConfig {
  /** BCP-47 language tag, e.g. "en-US". */
  language: string;
  /** Keep recognizing after each result (voice mode stays open). */
  continuous: boolean;
  /** Deliver interim (non-final) results for live transcript display. */
  interimResults: boolean;
}

/** Configuration for the TTS engine abstraction. */
export interface TTSConfig {
  /** Azure TTS voice name, e.g. "en-US-JennyNeural". */
  voice: string;
  /** Speaking rate adjustment, e.g. "+0%". */
  rate: string;
  /** Pitch adjustment, e.g. "+0Hz". */
  pitch: string;
}

/** Request body sent to the backend TTS endpoint. */
export interface TTSRequest {
  text: string;
  voice: string;
  language?: string;
  stream?: boolean;
  rate?: string;
  pitch?: string;
}

/** Events emitted by the STT engine for the consumer hook. */
export interface STTEngineCallbacks {
  onResult: (result: STTResult) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart: () => void;
}
