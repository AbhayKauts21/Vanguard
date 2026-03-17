"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* Two-column split layout: chat (left) + avatar (right). */
export function SplitPanelLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className={cn("relative flex flex-1 overflow-hidden")}>
      {/* Chat panel — left column */}
      <div className="flex w-full flex-col border-r border-[var(--cleo-border)] md:w-1/2 lg:w-[45%]">
        {left}
      </div>

      {/* Avatar panel — right column (hidden on mobile) */}
      <div className="hidden flex-1 flex-col md:flex">{right}</div>
    </div>
  );
}
