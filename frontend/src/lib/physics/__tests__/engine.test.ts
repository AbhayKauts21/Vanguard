import { describe, it, expect } from "vitest";
import {
  dist,
  distSq,
  clamp,
  lerp,
  createParticle,
  computeMouseForce,
  computePanelRepulsion,
  stepParticle,
  applyShockwave,
} from "@/lib/physics/engine";
import { DEFAULT_PARTICLE_CONFIG } from "@/lib/physics/config";
import type { MouseState, ParticleState, BoundingRect } from "@/lib/physics/types";

/* ---------- Helpers ---------- */
function makeMouse(x = 0, y = 0): MouseState {
  return { x, y, lastX: x, lastY: y, vx: 0, vy: 0 };
}

function makeParticle(x = 0, y = 0): ParticleState {
  return { x, y, vx: 0, vy: 0, size: 1, opacity: 0.5, baseOpacity: 0.5 };
}

/* ---------- Vector utilities ---------- */
describe("vector utilities", () => {
  it("distSq returns squared distance", () => {
    expect(distSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });

  it("dist returns Euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it("clamp constrains value within range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("lerp interpolates linearly", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

/* ---------- Particle creation ---------- */
describe("createParticle", () => {
  it("creates particle within canvas bounds", () => {
    const p = createParticle(800, 600, DEFAULT_PARTICLE_CONFIG);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(800);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(600);
  });

  it("respects size range from config", () => {
    const config = { ...DEFAULT_PARTICLE_CONFIG, sizeMin: 2, sizeMax: 4 };
    const p = createParticle(800, 600, config);
    expect(p.size).toBeGreaterThanOrEqual(2);
    expect(p.size).toBeLessThanOrEqual(4);
  });

  it("initialises with zero velocity", () => {
    const p = createParticle(800, 600, DEFAULT_PARTICLE_CONFIG);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
  });
});

/* ---------- Mouse force ---------- */
describe("computeMouseForce", () => {
  const config = DEFAULT_PARTICLE_CONFIG;

  it("applies repulsion when inside repel radius", () => {
    const mouse = makeMouse(100, 100);
    /* Particle 50px to the right of mouse — inside 200px repel radius */
    const force = computeMouseForce({ x: 150, y: 100 }, mouse, config);
    expect(force.x).toBeGreaterThan(0); /* pushed right (away) */
    expect(Math.abs(force.y)).toBeLessThan(0.001); /* no vertical force */
  });

  it("applies attraction when in outer shell", () => {
    const mouse = makeMouse(100, 100);
    /* Particle 300px to the right — between repelRadius (200) and attractRadius (400) */
    const force = computeMouseForce({ x: 400, y: 100 }, mouse, config);
    expect(force.x).toBeLessThan(0); /* pulled left (toward mouse) */
  });

  it("returns zero force when outside attract radius", () => {
    const mouse = makeMouse(0, 0);
    const force = computeMouseForce({ x: 999, y: 999 }, mouse, config);
    expect(force.x).toBe(0);
    expect(force.y).toBe(0);
  });
});

/* ---------- Panel repulsion ---------- */
describe("computePanelRepulsion", () => {
  const config = DEFAULT_PARTICLE_CONFIG;
  const panel: BoundingRect = { left: 100, top: 100, right: 300, bottom: 400, width: 200, height: 300 };

  it("pushes particle away from panel", () => {
    /* Particle on the left edge of panel margin */
    const force = computePanelRepulsion({ x: 80, y: 250 }, [panel], config);
    expect(force.x).toBeLessThan(0); /* pushed further left */
  });

  it("returns zero force when far from panel", () => {
    const force = computePanelRepulsion({ x: 0, y: 0 }, [panel], config);
    expect(force.x).toBe(0);
    expect(force.y).toBe(0);
  });
});

/* ---------- Step particle ---------- */
describe("stepParticle", () => {
  it("applies friction to velocity each step", () => {
    const p = makeParticle(400, 300);
    p.vx = 10;
    p.vy = 10;
    const mouse = makeMouse(-9999, -9999); /* far away */
    stepParticle(p, mouse, [], 800, 600, DEFAULT_PARTICLE_CONFIG);
    expect(p.vx).toBeLessThan(10);
    expect(p.vy).toBeLessThan(10);
  });

  it("applies gravity (net downward drift over many steps)", () => {
    const p = makeParticle(400, 300);
    const mouse = makeMouse(-9999, -9999);
    /* Use zero jitter so gravity is the only vertical force */
    const noJitterConfig = { ...DEFAULT_PARTICLE_CONFIG, jitter: 0 };
    for (let i = 0; i < 100; i++) {
      stepParticle(p, mouse, [], 800, 600, noJitterConfig);
    }
    /* After 100 steps with only gravity, particle should have drifted downward */
    expect(p.y).toBeGreaterThan(300);
  });

  it("wraps particle at canvas edges", () => {
    const p = makeParticle(-30, 300); /* past left edge */
    const mouse = makeMouse(-9999, -9999);
    stepParticle(p, mouse, [], 800, 600, DEFAULT_PARTICLE_CONFIG);
    expect(p.x).toBeGreaterThan(700); /* wrapped to right side */
  });
});

/* ---------- Shockwave ---------- */
describe("applyShockwave", () => {
  it("pushes nearby particles outward from epicentre", () => {
    const p = makeParticle(110, 100);
    applyShockwave([p], { x: 100, y: 100 }, 500, 12);
    expect(p.vx).toBeGreaterThan(0); /* pushed to the right */
  });

  it("does not affect particles outside radius", () => {
    const p = makeParticle(1000, 1000);
    applyShockwave([p], { x: 100, y: 100 }, 200, 12);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
  });
});
