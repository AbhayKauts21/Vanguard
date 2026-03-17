"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

/* Chat input composer with send button. */
export function Composer({ onSend, disabled = false }: ComposerProps) {
  const t = useTranslations("chat");
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-end gap-2 border-t border-[var(--cleo-border)] px-4 py-3",
        "bg-[var(--cleo-bg-panel)] backdrop-blur-[var(--cleo-glass-blur)]",
      )}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("inputPlaceholder")}
        disabled={disabled}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-[var(--cleo-radius-md)] px-4 py-2.5",
          "border border-[var(--cleo-border)] bg-[var(--cleo-bg-input)]",
          "text-sm text-[var(--cleo-text-primary)] placeholder:text-[var(--cleo-text-muted)]",
          "focus:border-[var(--cleo-border-accent)] focus:outline-none",
          "transition-colors",
        )}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label={t("inputPlaceholder")}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-[var(--cleo-radius-md)]",
          "bg-[var(--cleo-cyan)]/10 border border-[var(--cleo-cyan)]/20",
          "text-[var(--cleo-cyan)] transition-all",
          "hover:bg-[var(--cleo-cyan)]/20 disabled:opacity-30 disabled:cursor-not-allowed",
        )}
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}
