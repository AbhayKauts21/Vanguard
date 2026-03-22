"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Phase 9: Skeleton loading state for the ChatPanel.
 * Renders shimmer placeholders mimicking message bubbles + composer.
 */
export function ChatPanelSkeleton() {
  return (
    <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden shadow-2xl panel-boundary">
      {/* Session status skeleton */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-white/5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Message area skeleton */}
      <div className="flex-1 flex flex-col gap-6 px-8 py-6 overflow-hidden">
        {/* User message skeleton — right aligned */}
        <div className="flex justify-end">
          <Skeleton className="h-12 w-[60%] rounded-2xl" />
        </div>

        {/* Assistant message skeleton — left aligned */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[80%] rounded-lg" />
          <Skeleton className="h-4 w-[65%] rounded-lg" />
          <Skeleton className="h-4 w-[45%] rounded-lg" />
        </div>

        {/* User message skeleton */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[50%] rounded-2xl" />
        </div>

        {/* Assistant message skeleton */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[75%] rounded-lg" />
          <Skeleton className="h-4 w-[55%] rounded-lg" />
        </div>
      </div>

      {/* Composer skeleton */}
      <div className="px-8 py-4 border-t border-white/5">
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
