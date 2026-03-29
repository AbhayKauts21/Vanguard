import { Suspense } from "react";
import { AdminPanel } from "@/domains/system/components/AdminPanel";
import { AdminPanelSkeleton } from "@/domains/system/components/AdminPanelSkeleton";
import { TopBar, AppShell } from "@/components/layout";

import { setRequestLocale } from "next-intl/server";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AppShell>
      <TopBar />
      <main className="relative z-10 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <Suspense fallback={<AdminPanelSkeleton />}>
          <AdminPanel />
        </Suspense>
      </main>
    </AppShell>
  );
}
