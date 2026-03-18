"use client";

/**
 * Reusable floating metric badge — glass panel with label + value.
 * Used for Synapse, Latency, or any future telemetry data point.
 * Positioned absolutely by parent — this component owns only its visual style.
 */
interface AvatarBadgeProps {
  /** Uppercase label text (e.g. "Synapse") */
  label: string;
  /** Metric value (e.g. "98.4%") */
  value: string;
  /** Extra CSS classes for positioning */
  className?: string;
  /** CSS animation-delay for staggered float */
  animationDelay?: string;
}

export function AvatarBadge({
  label,
  value,
  className = "",
  animationDelay = "0s",
}: AvatarBadgeProps) {
  return (
    <div
      className={`avatar-badge glass-panel px-5 py-3 rounded-xl border border-white/10 animate-float transition-transform duration-300 ${className}`}
      style={{ animationDelay }}
    >
      <p className="text-[9px] text-white/30 uppercase font-bold tracking-[0.2em]">
        {label}
      </p>
      <p className="text-lg font-light text-white/90">{value}</p>
    </div>
  );
}
