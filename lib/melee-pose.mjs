const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
export function meleePose(weapon, time, direction = weapon === 'spear' ? 'thrust' : 'right') {
  if (weapon === 'spear' && time >= 0 && direction !== 'thrust') {
    const windup = smooth(time / 0.2);
    const strike = smooth((time - 0.2) / 0.18);
    const recover = 1 - smooth((time - 0.38) / 0.52);
    if (direction === 'left' || direction === 'right')
      return { x: Math.PI / 2 + 0.18 * windup, y: (direction === 'left' ? -1 : 1) * (0.85 * windup - 0.9 * strike) * recover, z: 0, thrust: 0.18 * strike * recover };
    return { x: 2.4 * windup - 1.2 * strike, y: 0, z: 0, thrust: 0.15 * strike * recover };
  }
  if (weapon === 'sword' && time >= 0 && direction !== 'right') {
    if (direction === 'left') {
      const pose = meleePose(weapon, time);
      return { ...pose, y: -pose.y };
    }
    const windup = smooth(time / 0.14);
    const strike = smooth((time - 0.14) / 0.2);
    const recover = 1 - smooth((time - 0.34) / 0.34);
    if (direction === 'overhead')
      return { x: (2.9 * windup - 2.1 * strike) * recover, y: 0, z: 0, thrust: 0 };
    if (direction === 'thrust')
      return { x: Math.PI / 2 * windup * recover, y: 0, z: 0, thrust: 0.45 * strike * recover };
  }
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
