"use client";

import { useVoiceStore } from "@/domains/voice/model";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Compact voice HUD that keeps the chat thread fully readable and interactive
 * while voice mode is active.
 */
export function VoiceTranscript({
  onDeactivate,
  onInterrupt,
}: {
  onDeactivate?: () => void;
  onInterrupt?: () => void;
}) {
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const phase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const finalTranscript = useVoiceStore((s) => s.finalTranscript);
  const error = useVoiceStore((s) => s.error);
  const setError = useVoiceStore((s) => s.setError);

  if (!isVoiceMode) return null;

  const phaseConfig = {
    listening: {
      label: "Listening",
      dotColor: "bg-purple-400",
      ringColor: "border-purple-400/30",
      textColor: "text-purple-200",
    },
    processing: {
      label: "Processing",
      dotColor: "bg-amber-400",
      ringColor: "border-amber-400/30",
      textColor: "text-amber-200",
    },
    speaking: {
      label: "Speaking",
      dotColor: "bg-emerald-400",
      ringColor: "border-emerald-400/30",
      textColor: "text-emerald-200",
    },
    idle: {
      label: "Ready",
      dotColor: "bg-blue-400",
      ringColor: "border-blue-400/30",
      textColor: "text-blue-200",
    },
  };

  const currentPhase = phaseConfig[phase];
  const visibleTranscript = userTranscript || finalTranscript;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center px-4"
      >
        <div className="flex w-full max-w-2xl flex-col gap-3">
          {error ? (
            <div className="pointer-events-auto self-center">
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/12 px-4 py-2.5 shadow-lg shadow-red-950/30 backdrop-blur-xl">
                <span className="material-symbols-outlined text-sm text-red-300">
                  warning
                </span>
                <span className="text-[12px] font-medium text-red-100/90">
                  {error}
                </span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="pointer-events-auto text-red-200/60 transition-colors hover:text-red-100"
                  aria-label="Dismiss voice error"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-auto rounded-[28px] border border-white/12 bg-black/72 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full border ${currentPhase.ringColor} bg-white/[0.03] px-3 py-1.5`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${currentPhase.dotColor} ${phase === "processing" ? "animate-pulse" : ""}`}
                />
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${currentPhase.textColor}`}
                >
                  {currentPhase.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {phase === "speaking" ? (
                  <button
                    type="button"
                    onClick={() => onInterrupt?.()}
                    className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 transition-all hover:border-emerald-300/40 hover:bg-emerald-500/20"
                  >
                    Interrupt & Listen
                  </button>
                ) : null}

                {onDeactivate ? (
                  <button
                    type="button"
                    onClick={onDeactivate}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  >
                    End Session
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                <span className="material-symbols-outlined text-sm">mic</span>
                Your Voice
              </div>
              {visibleTranscript ? (
                <p className="text-[14px] leading-relaxed text-white/88">
                  {visibleTranscript}
                  {phase === "listening" ? (
                    <span className="ml-1 inline-block h-4 w-[2px] animate-pulse align-middle bg-purple-300/70" />
                  ) : null}
                </p>
              ) : (
                <p className="text-[13px] leading-relaxed text-white/45">
                  {phase === "speaking"
                    ? "CLEO is speaking in the background. You can interrupt anytime."
                    : "Voice mode is active. Start speaking when you're ready."}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
