/* Typed access to NEXT_PUBLIC_ env vars with safe defaults. */

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "CLEO",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en",
  supportedLocales: (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "en,es").split(","),
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
  enableAvatar: process.env.NEXT_PUBLIC_ENABLE_AVATAR === "true",
  enableAmbientEffects: process.env.NEXT_PUBLIC_ENABLE_AMBIENT_EFFECTS === "true",
  enableStreaming: process.env.NEXT_PUBLIC_ENABLE_STREAMING === "true",
} as const;
