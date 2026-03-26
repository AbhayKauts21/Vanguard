"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { EnergyCoreVisualState } from "@/domains/avatar/model/energy-core";

interface EnergyCoreCanvasProps {
  state: EnergyCoreVisualState;
}

interface EnergyCoreProfile {
  color: THREE.ColorRepresentation;
  speed: number;
  noise: number;
  scale: number;
  breathAmplitude: number;
  breathSpeed: number;
}

const ENERGY_CORE_PROFILES: Record<EnergyCoreVisualState, EnergyCoreProfile> = {
  idle: {
    color: 0x162d8f,
    speed: 0.062,
    noise: 0.036,
    scale: 1,
    breathAmplitude: 0.006,
    breathSpeed: 0.72,
  },
  syncing: {
    color: 0xc26109,
    speed: 0.132,
    noise: 0.061,
    scale: 1.01,
    breathAmplitude: 0.011,
    breathSpeed: 0.98,
  },
  speech: {
    color: 0x10968a,
    speed: 0.148,
    noise: 0.068,
    scale: 1.014,
    breathAmplitude: 0.014,
    breathSpeed: 1.08,
  },
};

const INITIAL_PROFILE = ENERGY_CORE_PROFILES.idle;

const vertexShader = `
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
    vec3 primaryFlow = normal * 1.1 + vec3(uTime * uSpeed * 0.85);
    vec3 secondaryFlow = position * 0.72 + vec3(3.1, -2.3, 1.7) - vec3(uTime * uSpeed * 0.38);
    float primaryNoise = snoise(primaryFlow);
    float secondaryNoise = snoise(secondaryFlow);
    vNoise = mix(primaryNoise, secondaryNoise, 0.32);
    vec3 newPosition = position + normal * vNoise * uNoiseIntensity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  varying float vNoise;
  uniform vec3 uColor;

  void main() {
    float alpha = 0.5 + 0.5 * vNoise;
    gl_FragColor = vec4(uColor + (vNoise * 0.12), alpha * 0.82);
  }
`;

export function EnergyCoreCanvas({ state }: EnergyCoreCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const targetStateRef = useRef<EnergyCoreProfile>(INITIAL_PROFILE);

  useEffect(() => {
    targetStateRef.current = ENERGY_CORE_PROFILES[state];

    if (maskRef.current) {
      maskRef.current.style.transform = `translate(-50%, -50%) scale(${targetStateRef.current.scale})`;
    }
  }, [state]);

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
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    const innerGeometry = new THREE.SphereGeometry(1, 32, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    scene.add(innerSphere);

    let animationFrameId = 0;
    const clock = new THREE.Clock();
    const targetColor = new THREE.Color(INITIAL_PROFILE.color);
    const targetScale = new THREE.Vector3(1, 1, 1);
    const innerTargetScale = new THREE.Vector3(1, 1, 1);

    const renderFrame = () => {
      const elapsedTime = clock.getElapsedTime();
      const targetProfile = targetStateRef.current;
      const breathWave = Math.sin(elapsedTime * targetProfile.breathSpeed) * targetProfile.breathAmplitude;
      const targetNoise = targetProfile.noise + targetProfile.noise * breathWave * 3;
      const targetScaleValue = targetProfile.scale + breathWave;

      material.uniforms.uTime.value = elapsedTime;
      targetColor.set(targetProfile.color);
      (material.uniforms.uColor.value as THREE.Color).lerp(
        targetColor,
        0.0055,
      );
      material.uniforms.uSpeed.value = THREE.MathUtils.lerp(
        material.uniforms.uSpeed.value,
        targetProfile.speed,
        0.0055,
      );
      material.uniforms.uNoiseIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uNoiseIntensity.value,
        targetNoise,
        0.0065,
      );

      targetScale.set(targetScaleValue, targetScaleValue, targetScaleValue);
      globe.scale.lerp(targetScale, 0.012);
      innerTargetScale.setScalar(1 + breathWave * 0.45);
      innerSphere.scale.lerp(innerTargetScale, 0.015);

      globe.rotation.y += 0.00068;
      globe.rotation.x += 0.00018;
      innerSphere.rotation.y -= 0.00024;

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
      material.dispose();
      innerMaterial.dispose();
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
