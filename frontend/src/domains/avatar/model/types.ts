/**
 * Avatar domain types — state machine, configuration, and voice mapping.
 *
 * Follows the state machine defined in the integration plan (§8.8):
 *   disconnected → idle → listening → speaking → idle
 */

/** Visual state the avatar can be in at any moment. */
export type AvatarVisualState =
  | "disconnected"
  | "idle"
  | "listening"
  | "speaking"
  | "error";

/** Quality presets forwarded to the HeyGen SDK. */
export type AvatarQualityPreset = "low" | "medium" | "high";

/** Per-locale voice mapping so the avatar speaks the user's language. */
export interface AvatarVoiceMapping {
  [locale: string]: string;
}

/** Configuration object consumed by the avatar hook. */
export interface AvatarConfig {
  avatarId: string;
  quality: AvatarQualityPreset;
  voiceMapping: AvatarVoiceMapping;
  defaultVoiceId: string;
}

/** Shape of the data returned by the HeyGen token endpoint. */
export interface HeyGenTokenResponse {
  token: string;
}

/** Events the avatar store can receive. */
export type AvatarStoreEvent =
  | { type: "CONNECT" }
  | { type: "DISCONNECT" }
  | { type: "START_LISTENING" }
  | { type: "START_SPEAKING" }
  | { type: "STOP_SPEAKING" }
  | { type: "ERROR"; message: string };
