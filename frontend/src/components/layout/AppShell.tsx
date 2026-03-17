"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* Full-screen shell with ambient effect layer support. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={cn("relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--cleo-bg-primary)]")}>
      {children}
    </div>
  );
}
