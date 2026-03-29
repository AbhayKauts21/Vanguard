import { TopBar, AppShell } from "@/components/layout";
import { BookStackSyncManager } from "@/domains/system/components/BookStackSyncManager";

import { setRequestLocale } from "next-intl/server";

export default async function BookStackSyncManagerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AppShell>
      <TopBar />
      <main className="relative z-10 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <BookStackSyncManager />
      </main>
    </AppShell>
  );
}
