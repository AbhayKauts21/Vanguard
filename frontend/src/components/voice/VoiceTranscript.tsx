"use client";

import { useVoiceStore } from "@/domains/voice/model";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Voice transcript overlay — displays real-time user speech and CLEO response
 * during voice mode with production-grade glass-morphism aesthetics.
 *
 * Reads all data directly from the voice store (no props needed).
 *
 * Layout:
 * - User transcript: right-aligned, purple glow (listening phase)
 * - CLEO transcript: left-aligned, emerald glow (speaking phase)
 * - Error banner: red, dismissible
 * - Phase status pill: center-bottom with pulsing dot
 */
export function VoiceTranscript({ onDeactivate }: { onDeactivate?: () => void }) {
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const phase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const cleoTranscript = useVoiceStore((s) => s.cleoTranscript);
  const error = useVoiceStore((s) => s.error);
  const setError = useVoiceStore((s) => s.setError);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as transcripts update
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Use rAF to ensure DOM has rendered the new content before scrolling
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [userTranscript, cleoTranscript]);

  if (!isVoiceMode) return null;

  const phaseConfig = {
    listening: {
      label: "Listening",
      dotColor: "bg-purple-400",
      ringColor: "border-purple-400/30",
      textColor: "text-purple-300/90",
    },
    processing: {
      label: "Processing",
      dotColor: "bg-amber-400",
      ringColor: "border-amber-400/30",
      textColor: "text-amber-300/90",
    },
    speaking: {
      label: "Speaking",
      dotColor: "bg-emerald-400",
      ringColor: "border-emerald-400/30",
      textColor: "text-emerald-300/90",
    },
    idle: {
      label: "Ready",
      dotColor: "bg-blue-400",
      ringColor: "border-blue-400/30",
      textColor: "text-blue-300/90",
    },
  };

  const currentPhase = phaseConfig[phase];

  return (
    <AnimatePresence>
      {isVoiceMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="absolute inset-0 z-30 flex flex-col pointer-events-none"
        >
          {/* Backdrop blur overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl" />

          {/* Scrollable transcript area — takes all space except bottom bar */}
          <div
            ref={scrollRef}
            className="relative z-10 flex-1 overflow-y-auto p-6"
            style={{ overscrollBehavior: "contain" }}
          >
            <div className="flex flex-col gap-4 min-h-full justify-end">
              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="mx-auto max-w-md"
                  >
                    <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 backdrop-blur-md">
                      <span className="material-symbols-outlined text-red-400 text-base shrink-0">
                        warning
                      </span>
                      <span className="text-red-300/90 text-[12px] font-light flex-1">
                        {error}
                      </span>
                      <button
                        type="button"
                        onClick={() => setError(null)}
                        className="text-red-400/60 hover:text-red-300 transition-colors pointer-events-auto"
                        aria-label="Dismiss voice error"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* User transcript */}
              <AnimatePresence>
                {userTranscript && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="self-end max-w-[85%]"
                  >
                    <div className="flex items-center gap-2 mb-1.5 justify-end">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Operator
                      </span>
                      <span className="material-symbols-outlined text-purple-400/60 text-sm">
                        mic
                      </span>
                    </div>
                    <div className="rounded-2xl rounded-tr-none border border-purple-500/20 bg-purple-500/[0.08] px-5 py-3 backdrop-blur-md">
                      <p className="text-white/90 text-[13px] leading-relaxed font-light break-words">
                        {userTranscript}
                        {phase === "listening" && (
                          <span className="inline-block w-[2px] h-4 bg-purple-400/60 ml-1 animate-pulse" />
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CLEO transcript */}
              <AnimatePresence>
                {cleoTranscript && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="self-start max-w-[90%]"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-end h-3 gap-[1px]">
                        <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.1s" }} />
                        <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.3s" }} />
                        <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.2s" }} />
                      </div>
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        CLEO Core
                      </span>
                    </div>
                    <div className="rounded-2xl rounded-tl-none border border-emerald-500/20 bg-emerald-500/[0.05] px-5 py-3 backdrop-blur-md">
                      <div
                        className="voice-transcript-md text-white/80 text-[13px] leading-relaxed font-light"
                        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleoTranscript}
                        </ReactMarkdown>
                        {phase === "speaking" && (
                          <span className="inline-block w-[2px] h-4 bg-emerald-400/60 ml-1 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Phase status pill + Stop Button — pinned to bottom */}
          <div className="relative z-10 flex justify-center items-center gap-3 pointer-events-auto shrink-0 py-4">
            <motion.div
              key={phase}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 rounded-full border ${currentPhase.ringColor} bg-black/60 px-4 py-1.5 backdrop-blur-md`}
            >
              <span className={`h-2 w-2 rounded-full ${currentPhase.dotColor} animate-pulse`} />
              <span className={`text-[10px] font-mono tracking-[0.2em] uppercase ${currentPhase.textColor}`}>
                {currentPhase.label}
              </span>
            </motion.div>

            {/* Stop Session Button */}
            <button
              type="button"
              onClick={() => onDeactivate?.()}
              className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 backdrop-blur-md transition-all hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30"
              title="End voice session"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
