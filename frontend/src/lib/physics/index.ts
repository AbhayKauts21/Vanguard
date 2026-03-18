export type { Vec2, MouseState, ParticleState, ParticleConfig, BoundingRect } from "./types";
export { DEFAULT_PARTICLE_CONFIG } from "./config";
export {
  dist,
  distSq,
  clamp,
  lerp,
  createParticle,
  computeMouseForce,
  computePanelRepulsion,
  stepParticle,
  applyShockwave,
} from "./engine";
export { drawParticle, drawConnections } from "./renderer";
