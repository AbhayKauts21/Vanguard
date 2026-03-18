"use client";

import { useEffect, useRef } from "react";

/**
 * Full-screen particle canvas with mouse velocity physics and panel repulsion.
 * Matches original HTML: 1200 particles, viscous friction, glow, connections.
 */
export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const mouse = { x: 0, y: 0, lastX: 0, lastY: 0, vx: 0, vy: 0 };
    const viscousFriction = 0.98;
    const particleDensity = 1200;

    class Particle {
      x: number; y: number; size: number;
      vx = 0; vy = 0; opacity: number;
      repelX = 0; repelY = 0;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.size = Math.random() * 2.5 + 1.2;
        this.opacity = Math.random() * 0.4 + 0.5;
      }

      draw() {
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = "rgba(255, 255, 255, 0.7)";
        ctx!.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      update(panels: DOMRect[]) {
        /* Mouse velocity influence */
        if (mouse.vx !== 0 || mouse.vy !== 0) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influenceRadius = 300;
          if (dist < influenceRadius) {
            const force = (influenceRadius - dist) / influenceRadius;
            this.vx += mouse.vx * force * 0.35;
            this.vy += mouse.vy * force * 0.35;
            this.vx += (Math.random() - 0.5) * 0.4;
            this.vy += (Math.random() - 0.5) * 0.4;
          }
        }

        this.vx *= viscousFriction;
        this.vy *= viscousFriction;

        /* Panel repulsion */
        for (const rect of panels) {
          const margin = 40;
          if (
            this.x > rect.left - margin && this.x < rect.right + margin &&
            this.y > rect.top - margin && this.y < rect.bottom + margin
          ) {
            const dx = this.x - (rect.left + rect.width / 2);
            const dy = this.y - (rect.top + rect.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            this.repelX += (dx / dist) * 1.2;
            this.repelY += (dy / dist) * 1.2;
          }
        }

        this.x += this.vx + this.repelX;
        this.y += this.vy + this.repelY;
        this.repelX *= 0.8;
        this.repelY *= 0.8;

        /* Wrap edges */
        if (this.x < -20) this.x = canvas!.width + 20;
        if (this.x > canvas!.width + 20) this.x = -20;
        if (this.y < -20) this.y = canvas!.height + 20;
        if (this.y > canvas!.height + 20) this.y = -20;
      }
    }

    let particles = Array.from({ length: particleDensity }, () => new Particle());

    function getPanelRects(): DOMRect[] {
      return Array.from(document.querySelectorAll(".panel-boundary")).map(
        (el) => el.getBoundingClientRect(),
      );
    }

    let panels = getPanelRects();
    let rafId: number;

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      mouse.vx = mouse.x - mouse.lastX;
      mouse.vy = mouse.y - mouse.lastY;
      mouse.lastX = mouse.x;
      mouse.lastY = mouse.y;

      for (const p of particles) {
        p.update(panels);
        p.draw();
      }

      mouse.vx *= 0.6;
      mouse.vy *= 0.6;
      rafId = requestAnimationFrame(animate);
    }

    animate();

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function onResize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      panels = getPanelRects();
      particles = Array.from({ length: particleDensity }, () => new Particle());
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    /* Refresh panel rects periodically */
    const panelInterval = setInterval(() => { panels = getPanelRects(); }, 2000);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      clearInterval(panelInterval);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: -2 }}
    />
  );
}
