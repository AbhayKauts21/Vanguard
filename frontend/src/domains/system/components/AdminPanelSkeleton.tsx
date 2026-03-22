"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Phase 9: Skeleton loading state for the AdminPanel.
 * Shown while health + sync data initial fetch is in-flight.
 */
export function AdminPanelSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 w-full">
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Left column — SyncStatusCard + SyncControls skeletons */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-3 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/5 p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-3 w-56 mb-6" />
            <Skeleton className="h-12 w-full rounded-xl mb-4" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-xl" />
              <Skeleton className="h-10 w-16 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Right columns — HealthGrid + SyncLog skeletons */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-48 mb-6" />
              <div className="grid gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
              <Skeleton className="h-5 w-28 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 border-l-2 border-white/5 pl-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
