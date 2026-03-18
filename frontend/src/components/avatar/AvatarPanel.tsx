"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AvatarTelemetry } from "./AvatarTelemetry";

/* Avatar image URL — liquid abstract core */
const AVATAR_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCpeq8jBonmavGvBAWhde8E9iQgZn49BLMuJ-qyqUjSrzaZiZ3Qxxuk1-ANrMrySMa5UJV9B319TROlURCDfXIvjj22ZOw3LJEhniIzPbTooxANRTGgfZ-fehLcOxyWzMv9Ikhhhn4rfFJA58CDv_HlyeA5-pCvEwnJT5CM3ulKGMA_MbdlCtNdk1Onmny0lH_JYkTW6Vcm0kx6cBWwVXo6NG-4CPoilS_XK06nU-XyoZb6dNSDp1OsGyYM63xxi9GnARJGTxquGdg";

/**
 * Avatar panel — exact match to original HTML.
 * Grid overlay, sphere-anchor with concentric rings, liquid core with SVG turbulence,
 * floating Synapse/Latency badges, CLEO-01 title with status indicators.
 */
export function AvatarPanel() {
  const t = useTranslations("avatar");

  /* Parallax mouse tracking on the liquid core */
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const core = document.getElementById("avatar-liquid-core");
      if (!core) return;
      const coreX = (e.clientX - window.innerWidth / 2) * 0.04;
      const coreY = (e.clientY - window.innerHeight / 2) * 0.04;
      core.style.transform = `translate(${coreX}px, ${coreY}px) scale(1.1)`;
    }
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <div
      className="h-full w-full rounded-xl border border-white/10 bg-black/40 overflow-hidden relative glass-panel flex items-center justify-center panel-boundary"
      id="avatar-layer"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />

      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Sphere anchor — concentric rings + liquid core */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <div className="relative w-[30rem] h-[30rem] flex items-center justify-center" id="sphere-anchor">
          {/* Outermost ring — very faint, slow spin */}
          <div className="absolute inset-0 rounded-full border border-white/[0.03] scale-[1.8] animate-spin-slow" />

          {/* Dashed ring */}
          <div
            className="absolute w-[440px] h-[440px] rounded-full border border-dashed border-white/10 animate-spin-slow"
            style={{ animationDuration: "40s" }}
          />

          {/* Core sphere with sharp pulse */}
          <div className="absolute inset-0 bg-white/5 rounded-full backdrop-blur-3xl overflow-hidden border border-white/[0.15] group shadow-[0_0_120px_rgba(255,255,255,0.05)] animate-sharp-pulse">
            {/* Liquid core image with SVG turbulence filter */}
            <div
              id="avatar-liquid-core"
              className="w-full h-full bg-cover bg-center mix-blend-overlay opacity-40 grayscale brightness-150"
              style={{
                backgroundImage: `url('${AVATAR_IMAGE}')`,
                transform: "scale(1.1)",
                filter: "url(#liquid-filter) grayscale(1) brightness(1.5)",
                willChange: "filter, transform",
                transition: "transform 0.1s ease-out",
              }}
            />
            {/* Inner glow pulse */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-80 h-80 bg-white/5 rounded-full blur-[100px] animate-pulse" />
            </div>
          </div>

          {/* Floating Synapse badge — top right */}
          <div
            className="absolute top-0 -right-4 glass-panel px-5 py-3 rounded-xl border-white/10 animate-float"
            style={{ animationDelay: "-1.5s" }}
          >
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-[0.2em]">Synapse</p>
            <p className="text-lg font-light text-white/90">98.4%</p>
          </div>

          {/* Floating Latency badge — bottom left */}
          <div
            className="absolute bottom-10 -left-10 glass-panel px-5 py-3 rounded-xl border-white/10 animate-float"
            style={{ animationDelay: "-4s" }}
          >
            <p className="text-[9px] text-white/30 uppercase font-bold tracking-[0.2em]">Latency</p>
            <p className="text-lg font-light text-white/90">2ms</p>
          </div>
        </div>
      </div>

      {/* Bottom panel — CLEO-01 title + status + telemetry */}
      <div className="absolute bottom-0 left-0 right-0 p-10 flex justify-between items-end bg-gradient-to-t from-black via-black/20 to-transparent">
        <div className="flex flex-col gap-3">
          <h1 className="text-5xl font-extralight tracking-[0.4em] text-white/90 uppercase">
            CLEO-01
          </h1>
          <AvatarTelemetry />
        </div>
      </div>
    </div>
  );
}
