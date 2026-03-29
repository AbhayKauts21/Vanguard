import { setRequestLocale } from "next-intl/server";
import CleoInterface from "@/components/layout/CleoInterface";

/* Main CLEO page — rendered under /{locale}. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CleoInterface />;
}
