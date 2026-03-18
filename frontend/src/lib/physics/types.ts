/**
 * Core physics type definitions.
 * Shared across all physics-based visual systems (particles, parallax, etc.).
 */

/** 2D vector used for position, velocity, force calculations. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Mutable mouse state tracked across animation frames. */
export interface MouseState {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  vx: number;
  vy: number;
}

/** Individual particle state for the particle system. */
export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
}

/** Configuration for the particle physics engine. */
export interface ParticleConfig {
  /** Total number of particles. */
  count: number;
  /** Min particle radius in px. */
  sizeMin: number;
  /** Max particle radius in px. */
  sizeMax: number;
  /** Velocity damping per frame (0–1). Lower = snappier decay. */
  friction: number;
  /** Random jitter magnitude per frame (Brownian motion). */
  jitter: number;
  /** Constant downward acceleration (simulates gravity). */
  gravity: number;
  /** Mouse repulsion zone radius in px. */
  repelRadius: number;
  /** Mouse attraction shell outer radius in px. */
  attractRadius: number;
  /** Strength of mouse repulsion force. */
  repelStrength: number;
  /** Strength of mouse attraction force. */
  attractStrength: number;
  /** Max distance for drawing connection lines between particles. */
  connectionDistance: number;
  /** Maximum connection line opacity (0–1). */
  connectionMaxOpacity: number;
  /** Panel boundary repulsion margin in px. */
  panelMargin: number;
  /** Panel boundary repulsion force strength. */
  panelRepelStrength: number;
}

/** Bounding rectangle (cached from DOM). */
export interface BoundingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}
