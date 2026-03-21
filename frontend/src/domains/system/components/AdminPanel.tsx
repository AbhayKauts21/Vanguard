"use client";

import { SyncStatusCard } from "./SyncStatusCard";
import { SyncControls } from "./SyncControls";
import { HealthGrid } from "./HealthGrid";
import { SyncLog } from "./SyncLog";

export function AdminPanel() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-light tracking-tight text-white mb-2">System Administration</h1>
        <p className="text-white/50">Real-time ingestion telemetry and connectivity tracing for CLEO edge nodes.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Left Column - Priority Status */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <SyncStatusCard />
          <SyncControls />
        </div>

        {/* Center / Right Columns */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <HealthGrid />
            <SyncLog />
          </div>
          
          {/* Footer decorative node connection graph placeholder */}
          <div className="relative h-32 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent p-6 backdrop-blur-sm">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
            <div className="relative z-10 flex h-full items-center justify-center">
              <span className="text-xs uppercase tracking-[0.2em] text-white/20 mix-blend-plus-lighter">
                Neural Link Connectivity Established
              </span>
            </div>
            
            {/* Ambient moving light */}
            <div className="absolute -left-[100%] top-1/2 h-[2px] w-[200%] -translate-y-1/2 animate-[spin_10s_linear_infinite] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent blur-md"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
