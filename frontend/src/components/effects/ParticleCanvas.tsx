"use client";

import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { ISourceOptions } from "@tsparticles/engine";
import { PARTICLE_OPTIONS } from "@/lib/particles";

/**
 * Full-screen particle layer powered by tsParticles.
 * GPU-optimised canvas with built-in repulse, grab, links, parallax.
 * Config is injectable via props (Open/Closed principle).
 *
 * z-index 20 = foreground, pointer-events: none so UI stays clickable.
 * tsParticles handles retina detection, FPS limiting, and spatial hashing internally.
 */
interface ParticleCanvasProps {
  /** Override any tsParticles option */
  overrides?: Partial<ISourceOptions>;
}

export function ParticleCanvas({ overrides }: ParticleCanvasProps = {}) {
  const [ready, setReady] = useState(false);

  /* Initialise the tsParticles engine once per app lifetime */
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  /* Merge default config with any overrides */
  const options = useMemo<ISourceOptions>(
    () => ({ ...PARTICLE_OPTIONS, ...overrides }) as ISourceOptions,
    [overrides],
  );

  if (!ready) return null;

  return (
    <Particles
      id="cleo-particles"
      className="!fixed !inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
      options={options}
    />
  );
}
