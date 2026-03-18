"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_PARTICLE_CONFIG,
  createParticle,
  stepParticle,
  drawParticle,
  drawConnections,
  dist,
  type MouseState,
  type ParticleState,
  type BoundingRect,
  type ParticleConfig,
} from "@/lib/physics";

/**
 * Full-screen foreground particle canvas.
 * Uses the physics engine for two-zone mouse interaction (repel + attract),
 * Brownian jitter, gravity, panel repulsion, and constellation connections.
 *
 * z-index 20 = foreground (above glass panels), pointer-events: none so UI stays clickable.
 * Config is injectable via props for extensibility (Open/Closed principle).
 */
interface ParticleCanvasProps {
  config?: Partial<ParticleConfig>;
}

export function ParticleCanvas({ config: overrides }: ParticleCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ParticleState[]>([]);

  /** Expose shockwave trigger for external consumers (message send, etc.). */
  const triggerShockwave = useCallback(
    (epicentreX: number, epicentreY: number) => {
      const { applyShockwave } = require("@/lib/physics");
      applyShockwave(particlesRef.current, { x: epicentreX, y: epicentreY }, 500, 12);
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const config: ParticleConfig = { ...DEFAULT_PARTICLE_CONFIG, ...overrides };

    /* High-DPI support */
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);
    }
    resize();

    const logicalW = () => window.innerWidth;
    const logicalH = () => window.innerHeight;

    /* Initialise particles */
    particlesRef.current = Array.from({ length: config.count }, () =>
      createParticle(logicalW(), logicalH(), config),
    );

    /* Mouse state — tracked via window listener */
    const mouse: MouseState = { x: -9999, y: -9999, lastX: -9999, lastY: -9999, vx: 0, vy: 0 };

    /* Cached panel rects */
    let panels: BoundingRect[] = [];
    function refreshPanels() {
      panels = Array.from(document.querySelectorAll(".panel-boundary")).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      });
    }
    refreshPanels();

    let rafId: number;

    function animate() {
      const w = logicalW();
      const h = logicalH();
      ctx!.clearRect(0, 0, w, h);

      /* Update mouse velocity */
      mouse.vx = mouse.x - mouse.lastX;
      mouse.vy = mouse.y - mouse.lastY;
      mouse.lastX = mouse.x;
      mouse.lastY = mouse.y;

      const particles = particlesRef.current;

      /* Step & draw particles */
      for (const p of particles) {
        stepParticle(p, mouse, panels, w, h, config);

        /* Glow intensity: higher near mouse */
        const d = dist(p, mouse);
        const glow = d < config.repelRadius ? 1 - d / config.repelRadius : 0;
        drawParticle(ctx!, p, glow);
      }

      /* Connection lines (constellation mesh) */
      drawConnections(ctx!, particles, config);

      rafId = requestAnimationFrame(animate);
    }

    animate();

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function onResize() {
      resize();
      particlesRef.current = Array.from({ length: config.count }, () =>
        createParticle(logicalW(), logicalH(), config),
      );
      refreshPanels();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    /* Refresh panel rects periodically (panels might shift on scroll/resize). */
    const panelInterval = setInterval(refreshPanels, 2000);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      clearInterval(panelInterval);
    };
  }, [overrides]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 20 }}
    />
  );
}
