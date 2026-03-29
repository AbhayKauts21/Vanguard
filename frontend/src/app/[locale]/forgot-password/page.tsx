import { AuthPageShell, ForgotPasswordCard } from "@/domains/auth/components";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthPageShell
      eyebrow={t("forgotEyebrow")}
      title={t("forgotTitle")}
      description={t("forgotDescription")}
    >
      <ForgotPasswordCard />
    </AuthPageShell>
  );
}
