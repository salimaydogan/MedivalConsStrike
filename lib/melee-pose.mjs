const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
export function meleePose(weapon, time) {
  if (weapon === 'spear') {
    const reach =
      time < 0
        ? 0
        : time < 0.2
          ? -0.12 * smooth(time / 0.2)
          : time < 0.38
            ? -0.12 + 0.82 * smooth((time - 0.2) / 0.18)
            : 0.7 * (1 - smooth((time - 0.38) / 0.52));
    return { x: Math.PI / 2, y: 0, z: 0, thrust: reach };
  }
  if (time < 0) return { x: 0, y: 0, z: 0, thrust: 0 };
  if (time < 0.14) {
    const t = smooth(time / 0.14);
    return { x: 2 * t, y: -1.05 * t, z: 0, thrust: 0 };
  }
  if (time < 0.34) {
    const t = smooth((time - 0.14) / 0.2);
    return { x: 2 - 0.85 * t, y: -1.05 + 2.1 * t, z: 0, thrust: 0 };
  }
  const t = 1 - smooth((time - 0.34) / 0.34);
  return { x: 1.15 * t, y: 1.05 * t, z: 0, thrust: 0 };
}
