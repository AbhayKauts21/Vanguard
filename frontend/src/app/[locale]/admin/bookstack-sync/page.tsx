import { TopBar, AppShell } from "@/components/layout";
import { BookStackSyncManager } from "@/domains/system/components/BookStackSyncManager";

export default function BookStackSyncManagerPage() {
  return (
    <AppShell>
      <TopBar />
      <main className="relative z-10 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <BookStackSyncManager />
      </main>
    </AppShell>
  );
}
