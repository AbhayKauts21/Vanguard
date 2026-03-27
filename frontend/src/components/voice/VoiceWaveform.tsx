"use client";

import { useVoiceStore } from "@/domains/voice/model";

/**
 * Real-time voice waveform visualizer — driven by the audioLevel from voice store.
 *
 * Displays animated bars that pulse in sync with CLEO's TTS audio output,
 * providing visual feedback that the avatar is speaking.
 */
export function VoiceWaveform() {
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const phase = useVoiceStore((s) => s.phase);
  const audioLevel = useVoiceStore((s) => s.audioLevel);

  if (!isVoiceMode || phase !== "speaking") return null;

  // Generate bar heights from audio level with slight variation
  const barCount = 12;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const offset = Math.sin(i * 0.8) * 0.3;
    const height = Math.max(3, (audioLevel + offset) * 20);
    return Math.min(24, height);
  });

  return (
    <div className="flex items-end gap-[2px] h-6">
      {bars.map((height, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-emerald-400/70 transition-all duration-75"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}
