import { AuthFormCard, AuthPageShell } from "@/domains/auth/components";
import { getTranslations } from "next-intl/server";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <AuthPageShell
      eyebrow={t("loginEyebrow")}
      title={t("loginTitle")}
      description={t("loginDescription")}
    >
      <AuthFormCard mode="login" />
    </AuthPageShell>
  );
}
