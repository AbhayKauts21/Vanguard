import { AuthFormCard, AuthPageShell } from "@/domains/auth/components";
import { getTranslations } from "next-intl/server";

export default async function RegisterPage() {
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
