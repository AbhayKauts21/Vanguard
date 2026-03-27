"use client";

import { useVoiceStore } from "@/domains/voice/model";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Voice transcript overlay — displays real-time user speech and CLEO response
 * during voice mode with production-grade glass-morphism aesthetics.
 *
 * Layout:
 * - User transcript: right-aligned, purple glow (listening phase)
 * - CLEO transcript: left-aligned, emerald glow (speaking phase)
 * - Phase status pill: center-bottom with pulsing dot
 */
export function VoiceTranscript() {
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const phase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const cleoTranscript = useVoiceStore((s) => s.cleoTranscript);

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
          className="absolute inset-x-0 bottom-0 top-0 z-30 flex flex-col justify-end p-8 pointer-events-none"
        >
          {/* Backdrop blur overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl" />

          {/* Transcript area */}
          <div className="relative z-10 flex flex-col gap-6 max-h-[70%] overflow-y-auto pb-20">
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
                    <p className="text-white/90 text-[13px] leading-relaxed font-light">
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
                  className="self-start max-w-[85%]"
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
                    <p className="text-white/80 text-[13px] leading-relaxed font-light">
                      {cleoTranscript}
                      {phase === "speaking" && (
                        <span className="inline-block w-[2px] h-4 bg-emerald-400/60 ml-1 animate-pulse" />
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Phase status pill */}
          <div className="relative z-10 flex justify-center pointer-events-auto">
            <motion.div
              key={phase}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 rounded-full border ${currentPhase.ringColor} bg-black/60 px-4 py-1.5 backdrop-blur-md`}
            >
              <span className={`h-2 w-2 rounded-full ${currentPhase.dotColor} animate-pulse`} />
              <span
                className={`text-[10px] font-mono tracking-[0.2em] uppercase ${currentPhase.textColor}`}
              >
                {currentPhase.label}
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
