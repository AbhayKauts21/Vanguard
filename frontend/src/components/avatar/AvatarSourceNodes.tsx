"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { fireNeuralLink } from "@/components/effects/NeuralSvgOverlay";
import type {
  EnergyCoreKnowledgeMode,
  EnergyCoreSourceNode,
} from "@/domains/avatar/model/energy-core-telemetry";

interface AvatarSourceNodesProps {
  nodes: EnergyCoreSourceNode[];
  mode: EnergyCoreKnowledgeMode;
}

const TIER_TONES = {
  primary: {
    dot: "border-cyan-300/35 bg-cyan-300/18 shadow-[0_0_24px_rgba(125,211,252,0.32)]",
    line: "from-cyan-300/45",
  },
  secondary: {
    dot: "border-emerald-300/30 bg-emerald-300/15 shadow-[0_0_20px_rgba(110,231,183,0.24)]",
    line: "from-emerald-300/35",
  },
  tertiary: {
    dot: "border-white/20 bg-white/8 shadow-[0_0_18px_rgba(255,255,255,0.16)]",
    line: "from-white/20",
  },
} as const;

function modeLabel(
  mode: EnergyCoreKnowledgeMode,
  labels: {
    grounded: string;
    context: string;
    fallback: string;
    idle: string;
  },
) {
  switch (mode) {
    case "grounded":
      return labels.grounded;
    case "uncertain":
      return labels.context;
    case "fallback":
      return labels.fallback;
    default:
      return labels.idle;
  }
}

export function AvatarSourceNodes({ nodes, mode }: AvatarSourceNodesProps) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {nodes.map((node, index) => (
        <OrbitNode key={node.id} node={node} mode={mode} index={index} />
      ))}
    </div>
  );
}

function OrbitNode({
  node,
  mode,
  index,
}: {
  node: EnergyCoreSourceNode;
  mode: EnergyCoreKnowledgeMode;
  index: number;
}) {
  const t = useTranslations("avatar");
  const labels = {
    grounded: t("sourceNodeGrounded"),
    context: t("sourceNodeContext"),
    fallback: t("sourceNodeFallback"),
    idle: t("sourceNodeIdle"),
  };
  const ref = useRef<HTMLButtonElement>(null);
  const tone = TIER_TONES[node.tier];
  const side = node.orbitAngle > 90 && node.orbitAngle < 270 ? "right" : "left";

  function handleClick() {
    if (ref.current) {
      fireNeuralLink(ref.current);
    }

    if (node.sourceUrl) {
      window.open(node.sourceUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className="absolute left-1/2 top-1/2 origin-left"
      style={{
        transform: `translateY(-50%) rotate(${node.orbitAngle}deg)`,
      }}
    >
      <span
        className={`pointer-events-none absolute left-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r ${tone.line} to-transparent`}
        style={{ width: `${node.radius - 26}px`, opacity: 0.7 }}
      />
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        aria-label={node.title}
        title={node.title}
        className="group pointer-events-auto absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
        style={{
          left: `${node.radius}px`,
          transform: `translate(-50%, -50%) rotate(${-node.orbitAngle}deg)`,
          animationDelay: `${index * 0.7}s`,
        }}
      >
        <span
          className={`relative flex h-4 w-4 items-center justify-center rounded-full border ${tone.dot} animate-float transition-transform duration-300 group-hover:scale-125`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
        </span>

        <span
          className={`pointer-events-none absolute top-1/2 hidden min-w-[12rem] max-w-[14rem] -translate-y-1/2 rounded-xl border border-white/10 bg-black/88 px-3 py-2 text-left shadow-2xl backdrop-blur-xl transition-all duration-300 group-hover:flex ${
            side === "left" ? "left-full ml-3" : "right-full mr-3 text-right"
          }`}
        >
          <span className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {modeLabel(mode, labels)}
            </span>
            <span className="text-[11px] font-semibold leading-tight text-white/92">
              {node.title}
            </span>
            <span className="truncate text-[10px] tracking-[0.08em] text-white/38">
              {node.sourceName || `Page ${node.pageId}`}
            </span>
            {node.snippet ? (
              <span className="max-h-[2.8rem] overflow-hidden text-[10px] leading-relaxed text-white/55">
                {node.snippet}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </div>
  );
}
