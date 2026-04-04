"use client";

import { useVoiceStore } from "@/domains/voice/model";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, HelpCircle, X } from "lucide-react";

export function QuickActionToast() {
  const suggestions = useVoiceStore((s) => s.suggestions);
  const setSuggestions = useVoiceStore((s) => s.setSuggestions);
  const setUserTranscript = useVoiceStore((s) => s.setUserTranscript);
  const setFinalTranscript = useVoiceStore((s) => s.setFinalTranscript);
  const phase = useVoiceStore((s) => s.phase);

  if (suggestions.length === 0) return null;

  const handleAction = (text: string) => {
    // Simulate user speaking the suggestion
    setUserTranscript(text);
    setFinalTranscript(text);
    setSuggestions([]);
  };

  return (
    <AnimatePresence>
      {suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-auto max-w-md"
        >
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-purple-500/10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-purple-400" size={14} />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Quick Actions
                </span>
              </div>
              <button 
                onClick={() => setSuggestions([])}
                className="text-white/20 hover:text-white/40 transition-colors"
                aria-label="Dismiss suggestions"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleAction(s)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-purple-500/20 hover:border-purple-500/30 text-white/80 hover:text-white text-[12px] transition-all"
                >
                  <MessageCircle size={12} className="text-purple-400" />
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
