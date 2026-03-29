import { AuthFormCard, AuthPageShell } from "@/domains/auth/components";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthPageShell
      eyebrow={t("registerEyebrow")}
      title={t("registerTitle")}
      description={t("registerDescription")}
    >
      <AuthFormCard mode="register" />
    </AuthPageShell>
  );
}
