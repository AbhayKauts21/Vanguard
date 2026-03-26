"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { EnergyCoreVisualState } from "@/domains/avatar/model/energy-core";
import type { EnergyCoreKnowledgeMode } from "@/domains/avatar/model/energy-core-telemetry";

interface EnergyCoreCanvasProps {
  state: EnergyCoreVisualState;
  confidence: number;
  streamPulse: number;
  knowledgeMode: EnergyCoreKnowledgeMode;
}

interface EnergyCoreProfile {
  color: THREE.ColorRepresentation;
  speed: number;
  noise: number;
  scale: number;
}

const ENERGY_CORE_PROFILES: Record<EnergyCoreVisualState, EnergyCoreProfile> = {
  idle: {
    color: 0x1e3a8a,
    speed: 0.1,
    noise: 0.042,
    scale: 1,
  },
  syncing: {
    color: 0xd97706,
    speed: 0.22,
    noise: 0.082,
    scale: 1.012,
  },
  speech: {
    color: 0x14b8a6,
    speed: 0.25,
    noise: 0.094,
    scale: 1.018,
  },
};

const INITIAL_PROFILE = ENERGY_CORE_PROFILES.idle;

const vertexShader = `
  varying vec2 vUv;
  varying float vNoise;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uNoiseIntensity;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(
      dot(p0, p0),
      dot(p1, p1),
      dot(p2, p2),
      dot(p3, p3)
    ));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(
      dot(x0, x0),
      dot(x1, x1),
      dot(x2, x2),
      dot(x3, x3)
    ), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(
      dot(p0, x0),
      dot(p1, x1),
      dot(p2, x2),
      dot(p3, x3)
    ));
  }

  void main() {
    vUv = uv;
    vNoise = snoise(normal + uTime * uSpeed);
    vec3 newPosition = position + normal * vNoise * uNoiseIntensity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying float vNoise;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uPulse;
  uniform float uConfidence;

  void main() {
    float alpha = 0.48 + 0.38 * vNoise;
    float bandPosition = fract(uTime * (0.08 + (uPulse * 0.24)));
    float band = smoothstep(0.24, 0.0, abs(vUv.y - bandPosition));
    vec3 confidenceGlow = uColor * (0.1 + (uConfidence * 0.18));
    vec3 pulseGlow = vec3(1.0) * band * (0.08 + (uPulse * 0.28));
    vec3 color = uColor + (vNoise * 0.12) + confidenceGlow + pulseGlow;
    float opacity = (alpha * 0.78) + (band * 0.08) + (uConfidence * 0.06);
    gl_FragColor = vec4(color, opacity);
  }
`;

export function EnergyCoreCanvas({
  state,
  confidence,
  streamPulse,
  knowledgeMode,
}: EnergyCoreCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const targetStateRef = useRef<EnergyCoreProfile>(INITIAL_PROFILE);
  const confidenceRef = useRef(confidence);
  const streamPulseRef = useRef(streamPulse);
  const knowledgeModeRef = useRef(knowledgeMode);

  useEffect(() => {
    targetStateRef.current = ENERGY_CORE_PROFILES[state];

    if (maskRef.current) {
      maskRef.current.style.transform = `translate(-50%, -50%) scale(${targetStateRef.current.scale})`;
    }
  }, [state]);

  useEffect(() => {
    confidenceRef.current = confidence;
  }, [confidence]);

  useEffect(() => {
    streamPulseRef.current = streamPulse;
  }, [streamPulse]);

  useEffect(() => {
    knowledgeModeRef.current = knowledgeMode;
  }, [knowledgeMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.offsetWidth / container.offsetHeight,
      0.1,
      1000,
    );

    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1.2, 7);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(INITIAL_PROFILE.color) },
        uSpeed: { value: INITIAL_PROFILE.speed },
        uNoiseIntensity: { value: INITIAL_PROFILE.noise },
        uPulse: { value: streamPulseRef.current },
        uConfidence: { value: confidenceRef.current },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const globe = new THREE.Mesh(geometry, material);
    coreGroup.add(globe);

    const innerGeometry = new THREE.SphereGeometry(1, 32, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    coreGroup.add(innerSphere);

    const nucleusGeometry = new THREE.IcosahedronGeometry(0.34, 3);
    const nucleusMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
    });
    const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
    coreGroup.add(nucleus);

    const haloGeometry = new THREE.SphereGeometry(1.16, 32, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(INITIAL_PROFILE.color),
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    coreGroup.add(halo);

    const ringGeometry = new THREE.TorusGeometry(1.62, 0.018, 20, 180);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(INITIAL_PROFILE.color),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI * 0.24;
    ring.rotation.y = Math.PI * 0.08;
    coreGroup.add(ring);

    const secondaryRingGeometry = new THREE.TorusGeometry(1.42, 0.012, 16, 140);
    const secondaryRingMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const secondaryRing = new THREE.Mesh(secondaryRingGeometry, secondaryRingMaterial);
    secondaryRing.rotation.x = Math.PI * 0.72;
    secondaryRing.rotation.z = Math.PI * 0.18;
    coreGroup.add(secondaryRing);

    let animationFrameId = 0;
    const clock = new THREE.Clock();
    let currentPulse = streamPulseRef.current;
    let currentConfidence = confidenceRef.current;
    const targetColor = new THREE.Color(INITIAL_PROFILE.color);
    const modeColor = new THREE.Color(INITIAL_PROFILE.color);
    const secondaryModeColor = new THREE.Color(0xffffff);
    const white = new THREE.Color(0xffffff);

    const renderFrame = () => {
      const elapsedTime = clock.getElapsedTime();
      const targetProfile = targetStateRef.current;
      const mode = knowledgeModeRef.current;
      targetColor.set(targetProfile.color);
      if (mode === "uncertain") {
        modeColor.set(0xf59e0b);
      } else if (mode === "fallback") {
        modeColor.set(0x60a5fa);
      } else if (mode === "grounded") {
        modeColor.set(0x5eead4);
      } else {
        modeColor.copy(targetColor);
      }
      secondaryModeColor.copy(modeColor).lerp(white, 0.35);

      currentPulse = THREE.MathUtils.lerp(currentPulse, streamPulseRef.current, 0.08);
      currentConfidence = THREE.MathUtils.lerp(currentConfidence, confidenceRef.current, 0.035);

      material.uniforms.uTime.value = elapsedTime;
      (material.uniforms.uColor.value as THREE.Color).lerp(
        targetColor,
        0.008,
      );
      material.uniforms.uSpeed.value = THREE.MathUtils.lerp(
        material.uniforms.uSpeed.value,
        targetProfile.speed,
        0.008,
      );
      material.uniforms.uNoiseIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uNoiseIntensity.value,
        targetProfile.noise,
        0.008,
      );
      material.uniforms.uPulse.value = currentPulse;
      material.uniforms.uConfidence.value = currentConfidence;

      globe.scale.lerp(
        new THREE.Vector3(targetProfile.scale, targetProfile.scale, targetProfile.scale),
        0.01,
      );
      globe.rotation.y += 0.0011;
      globe.rotation.x += 0.00028;
      innerSphere.rotation.y -= 0.00045;
      coreGroup.rotation.z += 0.00032;

      const ringScale = 1.01 + currentConfidence * 0.05 + currentPulse * 0.02;
      ring.scale.lerp(new THREE.Vector3(ringScale, ringScale, ringScale), 0.04);
      ring.rotation.z += 0.0024 + currentPulse * 0.0012;
      secondaryRing.rotation.y -= 0.0021;
      secondaryRing.rotation.x += 0.0006;

      nucleus.scale.lerp(
        new THREE.Vector3(
          0.88 + currentPulse * 0.34,
          0.88 + currentPulse * 0.34,
          0.88 + currentPulse * 0.34,
        ),
        0.08,
      );
      nucleus.rotation.x += 0.0032;
      nucleus.rotation.y -= 0.0022;

      ringMaterial.color.lerp(modeColor, 0.04);
      ringMaterial.opacity = 0.12 + currentConfidence * 0.18 + currentPulse * 0.08;
      secondaryRingMaterial.color.lerp(secondaryModeColor, 0.05);
      secondaryRingMaterial.opacity = 0.08 + currentConfidence * 0.08;
      haloMaterial.color.lerp(modeColor, 0.05);
      haloMaterial.opacity = 0.04 + currentConfidence * 0.08 + currentPulse * 0.05;
      nucleusMaterial.opacity = 0.12 + currentConfidence * 0.12 + currentPulse * 0.14;

      renderer.render(scene, camera);
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const renderStaticFrame = () => {
      renderer.render(scene, camera);
    };

    const handleResize = () => {
      if (!container.offsetWidth || !container.offsetHeight) {
        return;
      }

      renderer.setSize(container.offsetWidth, container.offsetHeight);
      camera.aspect = container.offsetWidth / container.offsetHeight;
      camera.updateProjectionMatrix();
    };

    handleResize();

    if (prefersReducedMotion) {
      renderStaticFrame();
    } else {
      renderFrame();
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(animationFrameId);
      geometry.dispose();
      innerGeometry.dispose();
      nucleusGeometry.dispose();
      haloGeometry.dispose();
      ringGeometry.dispose();
      secondaryRingGeometry.dispose();
      material.dispose();
      innerMaterial.dispose();
      nucleusMaterial.dispose();
      haloMaterial.dispose();
      ringMaterial.dispose();
      secondaryRingMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div ref={containerRef} id="three-canvas-container" className="absolute inset-0 z-10" />
      <div
        ref={maskRef}
        id="energy-core-mask-target"
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[500px] w-[500px] rounded-full"
        style={{ transform: "translate(-50%, -50%) scale(1)" }}
      />
    </>
  );
}
