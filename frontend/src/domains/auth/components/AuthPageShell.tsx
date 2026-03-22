"use client";

import { AppShell, TopBar } from "@/components/layout";
import { GlassCard } from "@/components/ui";
import type { ReactNode } from "react";

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <TopBar />
      <main className="relative z-10 flex min-h-[calc(100vh-5.5rem)] items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-3xl">
          <GlassCard className="relative overflow-hidden p-6 md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(85,190,255,0.1),transparent_45%)]" />
            <div className="relative z-10">
              <div className="mb-8">
                <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-white/45">
                  {eyebrow}
                </p>
                <h1 className="mb-3 text-3xl font-light tracking-tight text-white md:text-4xl">
                  {title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-white/60">
                  {description}
                </p>
              </div>

              {children}
            </div>
          </GlassCard>
        </div>
      </main>
    </AppShell>
  );
}
