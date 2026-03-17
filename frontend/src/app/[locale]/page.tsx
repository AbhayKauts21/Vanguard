import { useTranslations } from "next-intl";

/* Main CLEO page — rendered under /{locale}. */
export default function HomePage() {
  const t = useTranslations("common");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a12]">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white/90">{t("appName")}</h1>
        <p className="mt-3 text-lg text-white/50">{t("appTagline")}</p>
      </div>
    </main>
  );
}
