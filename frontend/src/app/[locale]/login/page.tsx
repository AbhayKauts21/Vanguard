import { AuthFormCard, AuthPageShell } from "@/domains/auth/components";
import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const t = await getTranslations("auth");

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
