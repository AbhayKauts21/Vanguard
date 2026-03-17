import { cn } from "@/lib/utils";

/* Skeleton loading placeholder with shimmer. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-[var(--cleo-radius-sm)]", className)}
      {...props}
    />
  );
}
