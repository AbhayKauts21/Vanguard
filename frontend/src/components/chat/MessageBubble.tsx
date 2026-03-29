"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import type { Citation } from "@/types";
import { CitationList } from "./CitationList";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  primary_citations?: Citation[];
  secondary_citations?: Citation[];
  all_citations?: Citation[];
  hidden_sources_count?: number;
  modeUsed?: 'rag' | 'uncertain' | 'azure_fallback';
  maxConfidence?: number;
  whatIFound?: { page_title: string; score: number; source_url?: string }[];
  isStreaming?: boolean;
  delay?: number;
}

/**
 * Single chat message with Markdown support.
 * CLEO messages: waveform icon + left-aligned rounded-tl-none bubble.
 * Operator messages: diamond icon + right-aligned rounded-tr-none bubble.
 */
export function MessageBubble({ 
  role, 
  content, 
  primary_citations, 
  secondary_citations, 
  all_citations, 
  hidden_sources_count, 
  modeUsed,
  maxConfidence,
  whatIFound,
  isStreaming, 
  delay = 0 
}: MessageBubbleProps) {
  const t = useTranslations("chat");
  const isUser = role === "user";

  return (
    <div
      className={`flex flex-col gap-3 w-fit max-w-[95%] message-bloom message-echo ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
      style={{
        animationDelay: `${delay}s`,
      }}
    >
      {/* Sender label row */}
      <div className={`flex items-center gap-3 mb-0.5 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar icon */}
        <div className="size-6 rounded-full glass-panel flex items-center justify-center border border-white/20 bg-white/5">
          {isUser ? (
            /* Diamond shape for operator */
            <div className="w-3 h-3 rotate-45 border border-white/40" />
          ) : (
            /* Waveform bars for CLEO */
            <div className="flex items-end h-3 gap-[1px]">
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.1s" }} />
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.3s" }} />
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.2s" }} />
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
          {isUser ? "Operator" : "CLEO Core"}
        </span>
      </div>

      {/* Message bubble */}
      <div
        className={`border border-white/10 p-5 text-white/80 text-[13px] leading-relaxed shadow-sm hover:border-white/20 transition-colors w-fit max-w-full break-words ${
          isUser
            ? "bg-white/[0.08] rounded-2xl rounded-tr-none text-white/90"
            : "bg-white/[0.03] rounded-2xl rounded-tl-none"
        }`}
      >
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            h3: ({ children }) => <h3 className="text-[14px] font-bold text-white/90 mt-4 mb-2 uppercase tracking-wide">{children}</h3>,
            ul: ({ children }) => <ul className="list-disc ml-4 mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-4 mb-3 space-y-1">{children}</ol>,
            code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code"> & { inline?: boolean; node?: unknown }) => {
              return (
                <code
                  className={`${className} bg-white/10 rounded px-1.5 py-0.5 font-mono text-[12px] text-blue-300`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="p-4 bg-black/40 rounded-xl border border-white/10 my-4 overflow-x-auto font-mono text-[12px] text-blue-100/90 shadow-inner">
                {children}
              </pre>
            ),
          }}
        >
          {content}
        </ReactMarkdown>

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-[2px] h-4 bg-white/60 ml-0.5 animate-pulse align-middle" />
        )}

        {/* Tier 1: High confidence — show citations */}
        {modeUsed === "rag" && (
          <CitationList 
            primary={primary_citations}
            secondary={secondary_citations}
            all={all_citations}
            hiddenCount={hidden_sources_count}
          />
        )}

        {/* Tier 2: Uncertain — show honest deflection */}
        {modeUsed === "uncertain" && (
          <div className="mt-4 p-4 border border-yellow-500/20 bg-yellow-500/10 rounded-xl relative overflow-hidden group">
            <div className="flex items-start gap-3 relative z-10">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-yellow-400 font-bold mb-1 text-[13px] tracking-wide">
                  {t("uncertainTitle")}
                </p>
                <p className="text-yellow-400/80 leading-relaxed mb-3 text-[13px]">
                  {t("uncertainDesc")}
                </p>
                
                {whatIFound && whatIFound.length > 0 && (
                  <div className="mb-3">
                    <p className="text-yellow-500 text-[11px] uppercase tracking-wider font-bold mb-1.5 opacity-80">
                      {t("whatIFound")}
                    </p>
                    <ul className="space-y-1">
                      {whatIFound.map((item, idx) => {
                        const content = (
                          <>
                            <span className="w-1 h-1 bg-yellow-500/50 rounded-full" />
                            <span className="truncate">{item.page_title}</span>
                            <span className="text-yellow-500/50 text-[10px]">({Math.round(item.score * 100)}%)</span>
                          </>
                        );

                        if (item.source_url) {
                          return (
                            <li key={idx}>
                              <a 
                                href={item.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-yellow-400/90 text-[12px] flex items-center gap-2 hover:text-yellow-100 transition-colors w-full"
                              >
                                {content}
                              </a>
                            </li>
                          );
                        }

                        return (
                          <li key={idx} className="text-yellow-400/90 text-[12px] flex items-center gap-2">
                            {content}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                <a 
                  href="mailto:support@andino.com" 
                  className="inline-flex items-center gap-2 text-[12px] font-bold text-yellow-300 hover:text-yellow-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">mail</span>
                  {t("contactSupport")}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tier 3: Azure fallback — show mode indicator */}
        {modeUsed === "azure_fallback" && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10">
            <span className="text-blue-400 text-[14px]">⚡</span>
            <span className="text-blue-300/90 text-[11px] font-medium tracking-wide uppercase">
              {t("azureMode")}
            </span>
          </div>
        )}

        {/* Optional Debug confidence */}
        {maxConfidence !== undefined && maxConfidence > 0 && process.env.NODE_ENV === "development" && (
          <div className="mt-2 text-[10px] text-white/30 font-mono">
            Debug Confidence: {Math.round(maxConfidence * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
