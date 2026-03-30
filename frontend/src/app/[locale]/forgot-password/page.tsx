import { AuthPageShell, ForgotPasswordCard } from "@/domains/auth/components";
import { getTranslations } from "next-intl/server";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

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
