"use client";

import { useEffect, useRef } from "react";

/** Avatar image URL — liquid abstract core */
const AVATAR_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCpeq8jBonmavGvBAWhde8E9iQgZn49BLMuJ-qyqUjSrzaZiZ3Qxxuk1-ANrMrySMa5UJV9B319TROlURCDfXIvjj22ZOw3LJEhniIzPbTooxANRTGgfZ-fehLcOxyWzMv9Ikhhhn4rfFJA58CDv_HlyeA5-pCvEwnJT5CM3ulKGMA_MbdlCtNdk1Onmny0lH_JYkTW6Vcm0kx6cBWwVXo6NG-4CPoilS_XK06nU-XyoZb6dNSDp1OsGyYM63xxi9GnARJGTxquGdg";

/**
 * Avatar sphere — concentric rings + dynamic liquid core.
 * The core uses dual-layer SVG turbulence filters for continuous fluid motion.
 * Mouse distance dynamically adjusts displacement scale — closer = more morphing.
 * Separated from AvatarPanel for SRP/reusability.
 */
export function AvatarSphere() {
  const sphereRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const innerGlowRef = useRef<HTMLDivElement>(null);

  /* Mouse proximity → dynamic turbulence intensity + eye-tracking glow */
  useEffect(() => {
    const sphere = sphereRef.current;
    if (!sphere) return;

    function onMouseMove(e: MouseEvent) {
      if (!sphere) return;
      const rect = sphere.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      /* Adjust displacement scale based on proximity */
      const displace = document.getElementById("liquid-displace");
      if (displace) {
        const maxScale = 80;
        const minScale = 30;
        const proximity = Math.max(0, 1 - distance / 600);
        const scale = minScale + (maxScale - minScale) * proximity;
        displace.setAttribute("scale", String(scale));
      }

      /* Eye-tracking: inner glow hotspot follows cursor direction */
      if (innerGlowRef.current) {
        const maxShift = 40;
        const normX = (dx / (rect.width / 2)) * maxShift;
        const normY = (dy / (rect.height / 2)) * maxShift;
        innerGlowRef.current.style.transform = `translate(${normX}px, ${normY}px)`;
      }

      /* Recognition pulse on hover — scale up sphere slightly */
      const isHovering = distance < rect.width / 2;
      sphere.classList.toggle("sphere-hover", isHovering);
    }

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <div
      ref={sphereRef}
      className="relative w-[28rem] h-[28rem] flex items-center justify-center sphere-container"
      id="sphere-anchor"
    >
      {/* Outermost ring — very faint, slow spin */}
      <div className="absolute inset-0 rounded-full border border-white/[0.03] scale-[1.6] animate-spin-slow" />

      {/* Dashed ring — counter-rotate */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full border border-dashed border-white/10 animate-spin-slow"
        style={{ animationDuration: "40s", animationDirection: "reverse" }}
      />

      {/* Dotted orbit ring */}
      <div
        className="absolute w-[460px] h-[460px] rounded-full border border-dotted border-white/[0.04] animate-spin-slow"
        style={{ animationDuration: "60s" }}
      />

      {/* Core sphere with sharp pulse */}
      <div className="absolute inset-[15%] bg-white/5 rounded-full backdrop-blur-3xl overflow-hidden border border-white/[0.15] shadow-[0_0_120px_rgba(255,255,255,0.05)] animate-sharp-pulse sphere-core">
        {/* Liquid core image with SVG turbulence filter */}
        <div
          ref={coreRef}
          id="avatar-liquid-core"
          className="w-full h-full bg-cover bg-center mix-blend-overlay opacity-40 grayscale brightness-150"
          style={{
            backgroundImage: `url('${AVATAR_IMAGE}')`,
            transform: "scale(1.1)",
            filter: "url(#liquid-filter) grayscale(1) brightness(1.5)",
            willChange: "filter, transform",
            transition: "transform 0.1s ease-out",
            animation: "liquidBreathe 4s ease-in-out infinite",
          }}
        />

        {/* Inner glow — follows mouse for eye-tracking effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            ref={innerGlowRef}
            className="w-64 h-64 bg-white/8 rounded-full blur-[80px] transition-transform duration-300 ease-out"
          />
        </div>
      </div>
    </div>
  );
}
