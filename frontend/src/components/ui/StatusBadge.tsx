import { cn } from "@/lib/utils";

/* Pulsing dot badge for status indication. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: "online" | "offline" | "syncing";
  label: string;
  className?: string;
}) {
  const dotColor = {
    online: "bg-[var(--cleo-green)]",
    offline: "bg-red-500",
    syncing: "bg-[var(--cleo-cyan)] animate-glow-pulse",
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--cleo-text-muted)]",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      {label}
    </span>
  );
}
