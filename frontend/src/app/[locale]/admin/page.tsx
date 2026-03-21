import { AdminPanel } from "@/domains/system/components/AdminPanel";
import { TopBar } from "@/components/layout";

export default function AdminPage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-black text-white">
      <TopBar />
      {/* Background ambient effects to match demo UI */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-1/4 -left-1/4 w-[70vw] h-[70vw] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-sky-900/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>
      
      <div className="relative z-10 w-full rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-2xl p-6 md:p-12 overflow-y-auto max-h-[calc(100vh-8rem)]">
         <AdminPanel />
      </div>
    </main>
  );
}
