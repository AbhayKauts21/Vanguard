/* Typed access to NEXT_PUBLIC_ env vars with safe defaults. */

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "CLEO",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en",
  supportedLocales: (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "en,es").split(","),
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
  enableAvatar: process.env.NEXT_PUBLIC_ENABLE_AVATAR === "true",
  enableAmbientEffects: process.env.NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS === "true",
  enableStreaming: process.env.NEXT_PUBLIC_ENABLE_STREAMING === "true",
  heygen: {
    avatarId: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID ?? "Bryan_Base_Light",
    voiceId: process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID ?? "Default_Voice",
    voiceIdEs: process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID_ES ?? process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID ?? "Default_Voice",
  },
  voice: {
    enableVoiceMode: process.env.NEXT_PUBLIC_ENABLE_VOICE_MODE === "true",
    ttsVoice: process.env.NEXT_PUBLIC_TTS_VOICE ?? "en-US-JennyNeural",
    sttLanguage: process.env.NEXT_PUBLIC_STT_LANGUAGE ?? "en-US",
    silenceTimeoutMs: Number(process.env.NEXT_PUBLIC_VOICE_SILENCE_TIMEOUT_MS ?? "2000"),
  },
  adminApiKey: process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? "",
} as const;
