/**
 * TTS Engine — Azure Text-to-Speech via backend proxy.
 *
 * Sends text to the backend TTS endpoint which streams back MP3 audio.
 * Returns audio Blobs ready for the AudioQueue.
 *
 * Architecture:
 *   Frontend (TTS Engine) → POST /api/v1/voice/tts → Backend (Azure Speech SDK) → Audio Blob
 *
 * Fallback: Web Speech API SpeechSynthesis for offline/demo mode.
 */

import { env } from "@/lib/env";
import { getPersistedAccessToken } from "@/domains/auth/model";
import type { TTSRequest } from "@/domains/voice/model/types";

/** TTS endpoint on the backend. */
const TTS_ENDPOINT = "/api/v1/voice/tts";

/**
 * Synthesize text to audio via the backend Azure TTS proxy.
 * Returns an audio Blob (MP3) for playback.
 */
export async function synthesizeSpeech(
  text: string,
  options: Partial<Omit<TTSRequest, "text">> = {},
  signal?: AbortSignal,
): Promise<Blob> {
  const accessToken = getPersistedAccessToken();

  const body: TTSRequest = {
    text,
    voice: options.voice ?? env.voice.ttsVoice,
    rate: options.rate ?? "+0%",
    pitch: options.pitch ?? "+0Hz",
    sentiment: options.sentiment,
  };

  const response = await fetch(`${env.apiBaseUrl}${TTS_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Fallback TTS using the browser's built-in SpeechSynthesis API.
 * Used when the backend TTS endpoint is unavailable.
 *
 * Note: Quality is lower than Azure Neural voices, but works offline.
 */
export function speakWithBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("Browser TTS is not supported."));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = env.voice.sttLanguage;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      // "canceled" happens normally when we start a new turn.
      if (event.error === "canceled") {
        resolve();
      } else {
        reject(new Error(`Browser TTS error: ${event.error}`));
      }
    };

    window.speechSynthesis.speak(utterance);
  });
}
