"use client";

/**
 * Full-screen SVG layer for neural link lines between source cards and avatar.
 * Lines are drawn dynamically via fireNeuralLink().
 */
export function NeuralSvgOverlay() {
  return (
    <svg
      id="neural-svg"
      width="100%"
      height="100%"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 120 }}
    />
  );
}

/** Fire a neural link SVG path from an element to the avatar sphere. */
export function fireNeuralLink(sourceEl: HTMLElement) {
  const svg = document.getElementById("neural-svg");
  const sphere =
    document.getElementById("sphere-anchor") ??
    document.getElementById("energy-core-mask-target");
  if (!svg || !sphere) return;

  const rect = sourceEl.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  const core = sphere.getBoundingClientRect();
  const endX = core.left + core.width / 2;
  const endY = core.top + core.height / 2;

  const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 100;
  const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 100;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`);
  path.setAttribute("class", "neural-link-line");
  path.style.animation = "drawLink 1.5s ease-out forwards";

  svg.appendChild(path);
  setTimeout(() => path.remove(), 1600);
}
