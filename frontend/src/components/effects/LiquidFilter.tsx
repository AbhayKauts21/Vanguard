"use client";

/**
 * Hidden SVG defs for the liquid turbulence displacement filter.
 * Dual-layer noise: slow base undulation + fast surface shimmer.
 * The displacement scale is dynamically adjusted by AvatarSphere via DOM id.
 */
export function LiquidFilter() {
  return (
    <svg className="hidden" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="liquid-filter">
          {/* Layer 1: slow base undulation */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves={4}
            result="noise1"
          >
            <animate
              attributeName="baseFrequency"
              dur="8s"
              values="0.012 0.018;0.022 0.035;0.012 0.018"
              keyTimes="0;0.5;1"
              repeatCount="indefinite"
            />
          </feTurbulence>

          {/* Layer 2: fast surface shimmer */}
          <feTurbulence
            type="turbulence"
            baseFrequency="0.04"
            numOctaves={2}
            result="noise2"
          >
            <animate
              attributeName="baseFrequency"
              dur="3s"
              values="0.03 0.04;0.05 0.06;0.03 0.04"
              keyTimes="0;0.5;1"
              repeatCount="indefinite"
            />
          </feTurbulence>

          {/* Merge both noise layers */}
          <feMerge result="combinedNoise">
            <feMergeNode in="noise1" />
            <feMergeNode in="noise2" />
          </feMerge>

          {/* Displacement — scale is dynamically adjusted by AvatarSphere */}
          <feDisplacementMap
            id="liquid-displace"
            in="SourceGraphic"
            in2="combinedNoise"
            scale={50}
          />
        </filter>
      </defs>
    </svg>
  );
}
