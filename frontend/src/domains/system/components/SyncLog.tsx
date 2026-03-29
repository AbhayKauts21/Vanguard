import { useTranslations } from "next-intl";
import { useAuditStream } from "../hooks/useAuditStream";
import { formatDistanceToNow } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLocale } from "next-intl";

export function SyncLog() {
  const { events, isConnected } = useAuditStream();
  const t = useTranslations("system");
  const commonT = useTranslations("common");
  const locale = useLocale();
  
  const dateLocale = locale === "es" ? es : enUS;

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true,
        locale: dateLocale
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/40 hover:border-white/20">
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white/90">{t("eventLog")}</h3>
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className="text-[10px] uppercase tracking-wider text-white/30">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {events.length === 0 && !isConnected && (
            <div className="flex h-32 items-center justify-center text-sm text-white/40">
              {commonT("loading")}
            </div>
          )}
          
          {events.map((event) => (
            <div key={event.id} className="group/item flex flex-col gap-1 border-l-2 border-white/5 pl-4 text-sm transition-all hover:border-white/20">
              <div className="flex items-center justify-between">
                <span className={
                  event.status === "FAILURE" ? "text-red-400 font-medium" : "text-emerald-300/90 font-medium"
                }>
                  {t(`events.${event.event_code}`)}
                </span>
                <span className="shrink-0 text-[10px] text-white/30 tabular-nums">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">
                {event.description}
              </p>
            </div>
          ))}
          
          {isConnected && (
            <div className="flex gap-4 border-l-2 border-indigo-500/50 pl-4 text-sm">
              <span className="shrink-0 text-white/40">{t("listening")}</span>
              <span className="text-indigo-300 animate-pulse">{t("waitingEvents")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
