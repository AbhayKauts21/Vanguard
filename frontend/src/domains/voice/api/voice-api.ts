/**
 * Voice API client — communicates with backend voice endpoints.
 */

import { api } from "@/lib/api";
import type { TTSRequest } from "@/domains/voice/model/types";

/** TTS endpoint constant. */
export const VOICE_TTS_ENDPOINT = "/api/v1/voice/tts";

/**
 * Request TTS synthesis from the backend.
 * Returns a streaming Response for audio data.
 */
export async function requestTTS(body: TTSRequest, signal?: AbortSignal): Promise<Response> {
  return api.stream(VOICE_TTS_ENDPOINT, body, signal);
}
