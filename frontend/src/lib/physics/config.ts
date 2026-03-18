import type { ParticleConfig } from "./types";

/**
 * Default particle system configuration.
 * Tuned for a dense, responsive starfield with two-zone mouse interaction.
 */
export const DEFAULT_PARTICLE_CONFIG: Readonly<ParticleConfig> = {
  count: 2500,
  sizeMin: 0.5,
  sizeMax: 1.8,
  friction: 0.96,
  jitter: 0.3,
  gravity: 0.005,
  repelRadius: 200,
  attractRadius: 400,
  repelStrength: 8,
  attractStrength: 0.15,
  connectionDistance: 80,
  connectionMaxOpacity: 0.15,
  panelMargin: 30,
  panelRepelStrength: 1.5,
} as const;
