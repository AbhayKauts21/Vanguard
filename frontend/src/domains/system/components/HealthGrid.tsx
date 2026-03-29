"use client";

import { useHealthStatus } from "../hooks/useHealthStatus";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("status");
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.08]">
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
  const t = useTranslations("system");

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/40 hover:border-white/20">
      <div className="relative z-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white/90">{t("systemHealth")}</h3>
            <p className="text-sm text-white/50">{t("connectivityMatrix")}</p>
          </div>
          {isChecking && <span className="animate-pulse text-xs text-white/40">{t("polling")}</span>}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          <ServiceCard 
            name={t("backendApi")} 
            status={health?.status === "offline" ? "offline" : "online"} 
            detail={health?.metrics.uptime_seconds ? t("uptime", { value: Math.floor(health.metrics.uptime_seconds) }) : undefined}
          />
          <ServiceCard 
            name={t("pineconeDb")} 
            status={health?.services.pinecone.status} 
            detail={health?.services.pinecone.vectors !== undefined ? t("vectors", { value: health.services.pinecone.vectors }) : undefined}
          />
          <ServiceCard 
            name={t("bookstackWiki")} 
            status={health?.services.bookstack.status} 
            detail={health?.services.bookstack.pages !== undefined ? t("pagesExt", { value: health.services.bookstack.pages }) : undefined}
          />
          <ServiceCard 
            name={t("azureOpenAI")} 
            status={health?.services.azure_openai.status} 
            detail={health?.services.azure_openai.chat_deployment}
          />
          <ServiceCard 
            name={t("embeddings")}
            status={health?.services.embeddings.status}
            detail={
              health?.services.embeddings.model
                ? `${health?.services.embeddings.model} · ${health?.services.embeddings.dimensions}d`
                : undefined
            }
          />
          <ServiceCard
            name={t("postgres")}
            status={health?.services.postgres.status}
            detail={health?.services.postgres.database}
          />
        </div>
      </div>
    </div>
  );
}
