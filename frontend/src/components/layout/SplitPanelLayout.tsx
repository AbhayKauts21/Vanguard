"use client";

import type { ReactNode } from "react";

/* Two-column split: 40% chat + 60% avatar — matches original HTML. */
export function SplitPanelLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <main className="flex flex-1 overflow-hidden p-6 gap-6">
      <section className="w-[40%] flex flex-col gap-4 relative" id="chat-panel">
        {left}
      </section>
      <section className="w-[60%] relative" id="avatar-container">
        {right}
      </section>
    </main>
  );
}
