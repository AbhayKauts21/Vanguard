import type { Vec2, MouseState, ParticleState, ParticleConfig, BoundingRect } from "./types";

/**
 * Pure utility functions for particle physics calculations.
 * All functions are stateless and side-effect free — easy to unit test.
 */

/** Squared distance between two points (avoids sqrt for perf). */
export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance between two points. */
export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(distSq(a, b));
}

/** Clamp a value between min and max. */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Linear interpolation between a and b by factor t. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Create a fresh particle with random position within canvas bounds. */
export function createParticle(
  canvasW: number,
  canvasH: number,
  config: ParticleConfig,
): ParticleState {
  const baseOpacity = Math.random() * 0.4 + 0.3;
  return {
    x: Math.random() * canvasW,
    y: Math.random() * canvasH,
    vx: 0,
    vy: 0,
    size: Math.random() * (config.sizeMax - config.sizeMin) + config.sizeMin,
    opacity: baseOpacity,
    baseOpacity,
  };
}

/**
 * Compute mouse repulsion/attraction forces on a particle.
 * Two-zone model: inner zone repels (inverse-square), outer shell attracts gently.
 */
export function computeMouseForce(
  particle: Vec2,
  mouse: MouseState,
  config: ParticleConfig,
): Vec2 {
  const dx = particle.x - mouse.x;
  const dy = particle.y - mouse.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;

  /* Inner repulsion zone — inverse-square falloff */
  if (d < config.repelRadius) {
    const factor = config.repelStrength / (d * d) * config.repelRadius;
    return { x: (dx / d) * factor, y: (dy / d) * factor };
  }

  /* Outer attraction shell — gentle pull back */
  if (d < config.attractRadius) {
    const t = (d - config.repelRadius) / (config.attractRadius - config.repelRadius);
    const factor = config.attractStrength * t;
    return { x: -(dx / d) * factor, y: -(dy / d) * factor };
  }

  return { x: 0, y: 0 };
}

/**
 * Compute panel boundary repulsion force on a particle.
 * Pushes particles away from glass panel edges.
 */
export function computePanelRepulsion(
  particle: Vec2,
  panels: BoundingRect[],
  config: ParticleConfig,
): Vec2 {
  let fx = 0;
  let fy = 0;
  const { panelMargin, panelRepelStrength } = config;

  for (const rect of panels) {
    if (
      particle.x > rect.left - panelMargin &&
      particle.x < rect.right + panelMargin &&
      particle.y > rect.top - panelMargin &&
      particle.y < rect.bottom + panelMargin
    ) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = particle.x - cx;
      const dy = particle.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      fx += (dx / d) * panelRepelStrength;
      fy += (dy / d) * panelRepelStrength;
    }
  }

  return { x: fx, y: fy };
}

/**
 * Apply one simulation step to a particle (mutates in place for perf).
 * Integrates mouse forces, panel repulsion, Brownian jitter, gravity, friction.
 */
export function stepParticle(
  p: ParticleState,
  mouse: MouseState,
  panels: BoundingRect[],
  canvasW: number,
  canvasH: number,
  config: ParticleConfig,
): void {
  /* Mouse interaction forces */
  const mf = computeMouseForce(p, mouse, config);
  p.vx += mf.x;
  p.vy += mf.y;

  /* Panel repulsion */
  const pf = computePanelRepulsion(p, panels, config);
  p.vx += pf.x;
  p.vy += pf.y;

  /* Brownian jitter */
  p.vx += (Math.random() - 0.5) * config.jitter;
  p.vy += (Math.random() - 0.5) * config.jitter;

  /* Gravity */
  p.vy += config.gravity;

  /* Friction */
  p.vx *= config.friction;
  p.vy *= config.friction;

  /* Integrate position */
  p.x += p.vx;
  p.y += p.vy;

  /* Edge wrapping with soft margin */
  const margin = 20;
  if (p.x < -margin) p.x = canvasW + margin;
  if (p.x > canvasW + margin) p.x = -margin;
  if (p.y < -margin) p.y = canvasH + margin;
  if (p.y > canvasH + margin) p.y = -margin;

  /* Opacity: brighten near mouse, fade far */
  const md = dist(p, mouse);
  if (md < config.repelRadius) {
    p.opacity = lerp(p.baseOpacity, 1, 1 - md / config.repelRadius);
  } else {
    p.opacity = lerp(p.opacity, p.baseOpacity, 0.05);
  }
}

/**
 * Emit a radial shockwave that pushes all particles outward from an epicentre.
 * Used when a message is sent — call once to apply impulse.
 */
export function applyShockwave(
  particles: ParticleState[],
  epicentre: Vec2,
  radius: number,
  strength: number,
): void {
  for (const p of particles) {
    const dx = p.x - epicentre.x;
    const dy = p.y - epicentre.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < radius) {
      const force = (1 - d / radius) * strength;
      p.vx += (dx / d) * force;
      p.vy += (dy / d) * force;
    }
  }
}
