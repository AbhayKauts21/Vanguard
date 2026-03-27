export function spawnShockwave(x: number, y: number) {
  const ripple = document.createElement("div");

  ripple.className = "ripple-effect";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = "1000px";
  ripple.style.height = "1000px";
  ripple.style.marginLeft = "-500px";
  ripple.style.marginTop = "-500px";

  document.body.appendChild(ripple);

  window.setTimeout(() => {
    ripple.remove();
  }, 1000);
}
