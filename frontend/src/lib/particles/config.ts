import type { ISourceOptions } from "@tsparticles/engine";

/**
 * tsParticles configuration for the CLEO neural interface.
 * Dense starfield with mouse repulsion, grab connections, and subtle parallax.
 * All physics handled by the tsParticles GPU-optimised engine.
 */
export const PARTICLE_OPTIONS: ISourceOptions = {
  fpsLimit: 120,
  detectRetina: true,

  /* Transparent background — we have our own plasma/hex layers underneath */
  background: { color: "transparent" },

  interactivity: {
    events: {
      onHover: {
        enable: true,
        mode: ["repulse", "grab"],
        parallax: {
          enable: true,
          force: 40,
          smooth: 20,
        },
      },
      onClick: {
        enable: true,
        mode: "push",
      },
    },
    modes: {
      repulse: {
        distance: 150,
        duration: 0.4,
        speed: 0.5,
      },
      grab: {
        distance: 200,
        links: {
          opacity: 0.25,
          color: "#ffffff",
        },
      },
      push: {
        quantity: 6,
      },
    },
  },

  particles: {
    number: {
      value: 200,
      density: {
        enable: true,
        width: 1920,
        height: 1080,
      },
    },
    color: {
      value: "#ffffff",
    },
    shape: {
      type: "circle",
    },
    opacity: {
      value: { min: 0.15, max: 0.5 },
      animation: {
        enable: true,
        speed: 0.8,
        sync: false,
        startValue: "random",
        mode: "auto",
      },
    },
    size: {
      value: { min: 0.5, max: 2 },
      animation: {
        enable: true,
        speed: 1.5,
        sync: false,
        startValue: "random",
        mode: "auto",
      },
    },
    links: {
      enable: true,
      distance: 120,
      color: "#ffffff",
      opacity: 0.08,
      width: 0.5,
      triangles: {
        enable: false,
      },
    },
    move: {
      enable: true,
      speed: { min: 0.3, max: 1 },
      direction: "none",
      random: true,
      straight: false,
      outModes: {
        default: "out",
      },
      attract: {
        enable: false,
      },
    },
    shadow: {
      enable: true,
      blur: 4,
      color: "#ffffff",
    },
  },
} as const;
