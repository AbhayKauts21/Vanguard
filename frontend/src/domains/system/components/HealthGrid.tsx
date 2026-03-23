"use client";

import { useHealthStatus } from "../hooks/useHealthStatus";

/**
 * Service status card component
 */
function ServiceCard({ 
  name, 
  status, 
  detail 
}: { 
  name: string; 
  status?: "online" | "offline"; 
  detail?: string | number 
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          {status === "online" ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
          )}
        </span>
        <span className="text-sm font-medium text-white/90">{name}</span>
      </div>
      <span className="text-sm text-white/50">{detail ?? "—"}</span>
    </div>
  );
}

export function HealthGrid() {
  const { health, isChecking, error } = useHealthStatus();

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/50 hover:border-white/20">
      <div className="relative z-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white/90">System Health</h3>
            <p className="text-sm text-white/50">Connectivity tracing matrix</p>
          </div>
          {isChecking && <span className="animate-pulse text-xs text-white/40">Polling...</span>}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          <ServiceCard 
            name="Backend API" 
            status={health?.status === "offline" ? "offline" : "online"} 
            detail={health?.metrics.uptime_seconds ? `${Math.floor(health.metrics.uptime_seconds)}s uptime` : undefined}
          />
          <ServiceCard 
            name="Pinecone DB" 
            status={health?.services.pinecone.status} 
            detail={health?.services.pinecone.vectors !== undefined ? `${health.services.pinecone.vectors} vectors` : undefined}
          />
          <ServiceCard 
            name="BookStack Wiki" 
            status={health?.services.bookstack.status} 
            detail={health?.services.bookstack.pages !== undefined ? `${health.services.bookstack.pages} pages ext.` : undefined}
          />
          <ServiceCard 
            name="Azure OpenAI" 
            status={health?.services.azure_openai.status} 
            detail={health?.services.azure_openai.deployment}
          />
          <ServiceCard 
            name="OpenAI Engine" 
            status={health?.services.openai.status} 
            detail={health?.services.openai.model}
          />
        </div>
      </div>
    </div>
  );
}
