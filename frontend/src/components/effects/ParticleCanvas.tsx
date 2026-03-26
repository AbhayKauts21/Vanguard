"use client";

import { useEffect, useRef } from "react";

/**
 * Anti-gravity particle field — exact match to CLEO reference implementation.
 *
 * 1200 particles with slow drift, mouse repulsion (150px), sphere masking.
 * Canvas is foreground (z-index 100) with pointer-events: none.
 * Lightweight: no external physics lib, simple update/draw loop.
 */

/** Single particle with origin-return physics */
class Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  size: number;
  opacity: number;
  vx: number;
  vy: number;
  flowSeed: number;
  driftSeed: number;

  constructor(canvasW: number, canvasH: number) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.originX = this.x;
    this.originY = this.y;
    this.size = Math.random() * 1.5 + 0.5;
    this.opacity = Math.random() * 0.4 + 0.1;
    this.vx = (Math.random() - 0.5) * 0.1;
    this.vy = (Math.random() - 0.5) * 0.1;
    this.flowSeed = Math.random() * Math.PI * 2;
    this.driftSeed = Math.random() * Math.PI * 2;
  }

  /** Update position with fluid drift and a softer wave-like disturbance around the cursor. */
  update(
    mouseX: number | null,
    mouseY: number | null,
    canvasW: number,
    canvasH: number,
    time: number,
  ) {
    const ambientFlowX =
      Math.sin(time * 0.00045 + this.flowSeed + this.originY * 0.006) * 0.18;
    const ambientFlowY =
      Math.cos(time * 0.00055 + this.driftSeed + this.originX * 0.004) * 0.18;

    if (mouseX !== null && mouseY !== null) {
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 105) {
        const force = (105 - distance) / 105;
        const safeDistance = distance || 1;
        const awayX = -dx / safeDistance;
        const awayY = -dy / safeDistance;
        const tangentX = -awayY;
        const tangentY = awayX;
        const swirl = Math.sin(time * 0.003 + this.flowSeed) * 1.2;

        this.x += (awayX * 0.85 + tangentX * swirl) * force * 2.1;
        this.y += (awayY * 0.85 + tangentY * swirl) * force * 2.1;
      } else {
        this.x += (this.originX - this.x) * 0.016;
        this.y += (this.originY - this.y) * 0.016;
      }
    } else {
      this.x += (this.originX - this.x) * 0.016;
      this.y += (this.originY - this.y) * 0.016;
    }

    this.x += this.vx + ambientFlowX;
    this.y += this.vy + ambientFlowY;
    this.originX += this.vx * 0.45 + ambientFlowX * 0.16;
    this.originY += this.vy * 0.45 + ambientFlowY * 0.16;

    if (this.x < 0 || this.x > canvasW) this.vx *= -1;
    if (this.y < 0 || this.y > canvasH) this.vy *= -1;
    if (this.originX < 0 || this.originX > canvasW) this.vx *= -1;
    if (this.originY < 0 || this.originY > canvasH) this.vy *= -1;
  }

  /** Draw particle, skipping if inside the sphere mask area */
  draw(
    ctx: CanvasRenderingContext2D,
    sphereCx: number,
    sphereCy: number,
    sphereR: number,
  ) {
    /* Sphere masking — don't render particles inside the avatar sphere */
    if (sphereR > 0) {
      const distToSphere = Math.sqrt(
        (this.x - sphereCx) ** 2 + (this.y - sphereCy) ** 2,
      );
      if (distToSphere < sphereR) return;
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Cache sphere position from DOM */
function getSphereRect(): { cx: number; cy: number; r: number } {
  const el =
    document.getElementById("energy-core-mask-target") ??
    document.getElementById("avatar-sphere-mask-target");
  if (!el) return { cx: 0, cy: 0, r: 0 };
  const rect = el.getBoundingClientRect();
  return {
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
    r: rect.width / 2,
  };
}

const PARTICLE_COUNT = 1200;

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const mouse: { x: number | null; y: number | null } = {
      x: null,
      y: null,
    };

    /* Initialise particles */
    let particles = Array.from(
      { length: PARTICLE_COUNT },
      () => new Particle(canvas.width, canvas.height),
    );

    /* Cache sphere rect — refresh periodically */
    let sphere = getSphereRect();

    let rafId: number;

    function animate() {
      const now = performance.now();
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const p of particles) {
        p.update(mouse.x, mouse.y, canvas!.width, canvas!.height, now);
        p.draw(ctx!, sphere.cx, sphere.cy, sphere.r);
      }

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
      particles = Array.from(
        { length: PARTICLE_COUNT },
        () => new Particle(canvas!.width, canvas!.height),
      );
      sphere = getSphereRect();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    /* Refresh sphere rect periodically (it can shift on layout changes) */
    const sphereInterval = setInterval(() => {
      sphere = getSphereRect();
    }, 1000);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      clearInterval(sphereInterval);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="particle-canvas"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 50, backgroundColor: "transparent" }}
    />
  );
}
