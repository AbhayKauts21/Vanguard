import { setRequestLocale } from "next-intl/server";
import { DocumentLibrary } from "@/domains/knowledge/components/DocumentLibrary";

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocumentLibrary />;
}
