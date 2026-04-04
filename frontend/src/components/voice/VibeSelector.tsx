"use client";

import { useVoiceStore } from "@/domains/voice/model";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageSquare, Heart, GraduationCap } from "lucide-react";

const VIBES = [
  { id: "professional", label: "Formal", icon: GraduationCap, color: "text-blue-400", bg: "bg-blue-400/10" },
  { id: "friendly", label: "Friendly", icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { id: "cheerful", label: "Cheerful", icon: Sparkles, color: "text-amber-400", bg: "bg-amber-400/10" },
  { id: "empathetic", label: "Empathetic", icon: Heart, color: "text-purple-400", bg: "bg-purple-400/10" },
] as const;

export function VibeSelector() {
  const currentVibe = useVoiceStore((s) => s.vibe);
  const setVibe = useVoiceStore((s) => s.setVibe);

  return (
    <div className="flex items-center gap-2 px-1 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
      {VIBES.map((v) => {
        const isActive = currentVibe === v.id;
        const Icon = v.icon;

        return (
          <button
            key={v.id}
            onClick={() => setVibe(v.id)}
            className={`
              relative flex items-center justify-center p-2 rounded-full transition-all duration-300
              ${isActive ? "text-white" : "text-white/40 hover:text-white/60"}
            `}
            title={v.label}
          >
            {isActive && (
              <motion.div
                layoutId="vibe-active-bg"
                className={`absolute inset-0 rounded-full ${v.bg} border border-white/10`}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Icon size={16} className={`relative z-10 ${isActive ? v.color : ""}`} />
            
            <AnimatePresence>
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, w: 0 }}
                  animate={{ opacity: 1, w: "auto" }}
                  exit={{ opacity: 0, w: 0 }}
                  className="relative z-10 text-[10px] font-medium ml-2 mr-1 overflow-hidden whitespace-nowrap"
                >
                  {v.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
