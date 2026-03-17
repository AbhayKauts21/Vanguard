import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

/* Glass-styled card panel. */
const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--cleo-radius-md)] border border-[var(--cleo-border)]",
        "bg-[var(--cleo-bg-glass)] backdrop-blur-[var(--cleo-glass-blur)]",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
