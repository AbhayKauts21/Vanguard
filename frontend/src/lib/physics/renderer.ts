import type { ParticleState, ParticleConfig } from "./types";

/**
 * Particle rendering utilities — pure functions for canvas draw calls.
 * Separated from physics logic (SoC) for testability and reuse.
 */

/**
 * Draw a single particle as a glowing circle.
 * Uses shadowBlur only for particles near the mouse (perf optimisation).
 */
export function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: ParticleState,
  glowIntensity: number,
): void {
  if (glowIntensity > 0.5) {
    ctx.shadowBlur = 6 * glowIntensity;
    ctx.shadowColor = `rgba(255, 255, 255, ${0.5 * glowIntensity})`;
  }

  ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();

  if (glowIntensity > 0.5) {
    ctx.shadowBlur = 0;
  }
}

/**
 * Draw connection lines between particles that are close together.
 * Creates a constellation / neural mesh effect.
 */
export function drawConnections(
  ctx: CanvasRenderingContext2D,
  particles: ParticleState[],
  config: ParticleConfig,
): void {
  const { connectionDistance, connectionMaxOpacity } = config;
  const distSq = connectionDistance * connectionDistance;

  ctx.lineWidth = 0.5;

  /* Spatial partitioning: skip connections for particles far apart.
     We iterate pairs with early exit on X-axis distance for perf. */
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];

    /* Only process ~1/3 of connections for performance */
    if (i % 3 !== 0) continue;

    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];

      /* Quick X-axis rejection */
      const dx = a.x - b.x;
      if (dx > connectionDistance || dx < -connectionDistance) continue;

      const dy = a.y - b.y;
      if (dy > connectionDistance || dy < -connectionDistance) continue;

      const dSq = dx * dx + dy * dy;
      if (dSq > distSq) continue;

      const opacity = (1 - Math.sqrt(dSq) / connectionDistance) * connectionMaxOpacity;
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}
