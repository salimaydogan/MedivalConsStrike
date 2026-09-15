// Angular horizontal deviation in radians; calculated from authoritative state.
export function bowSpread(charge, speed = 0, mounted = false) {
  const draw = Math.max(0, Math.min(1, Number.isFinite(charge) ? charge : 0));
  const movement = Math.min(1, Math.abs(speed) / (mounted ? 13 : 6));
  return 0.12 * (1 - draw) ** 2 + movement * (mounted ? 0.09 : 0.05);
}
export function shotDeviation(id, spread) {
  const n = Math.sin(id * 127.1 + 311.7) * 43758.5453;
  return ((n - Math.floor(n)) * 2 - 1) * spread;
}
