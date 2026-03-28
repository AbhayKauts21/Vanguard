"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300",
        isOpen ? "bg-black/40 backdrop-blur-sm" : "bg-transparent backdrop-blur-0 pointer-events-none"
      )}
      onClick={onCancel}
    >
      <GlassCard
        className={cn(
          "w-full max-w-sm overflow-hidden p-6 shadow-2xl transition-all duration-300 transform",
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mb-6">
          <h3 className="text-lg font-light tracking-widest text-white/90 uppercase">
            {title}
          </h3>
          <div className="absolute -bottom-2 left-0 h-px w-12 bg-gradient-to-r from-white/40 to-transparent" />
        </div>

        <p className="mb-8 text-sm leading-relaxed text-white/60">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-white/40 transition-colors hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-xl border px-6 py-2.5 text-[11px] font-medium uppercase tracking-widest transition-all duration-300",
              isDestructive
                ? "border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/50 hover:bg-red-500/20"
                : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
            )}
          >
            {confirmLabel}
          </button>
        </div>

        {/* Neural decoration */}
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      </GlassCard>
    </div>
  );
}
