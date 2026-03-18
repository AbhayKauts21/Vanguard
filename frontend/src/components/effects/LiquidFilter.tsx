"use client";

/**
 * Hidden SVG defs for the liquid turbulence displacement filter.
 * Applied to the avatar core image.
 */
export function LiquidFilter() {
  return (
    <svg className="hidden" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="liquid-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves={3}
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="15s"
              values="0.015 0.02;0.025 0.04;0.015 0.02"
              keyTimes="0;0.5;1"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={50}
          />
        </filter>
      </defs>
    </svg>
  );
}
