export const WEAPONS = Object.freeze({
  sword: {
    label: 'Kılıç',
    cost: 24,
    damage: 34,
    range: 2.6,
    cosine: 0.5,
    hit: 0.24,
    duration: 0.68,
  },
  spear: {
    label: 'Mızrak',
    cost: 30,
    damage: 43,
    range: 4.3,
    cosine: 0.9,
    hit: 0.34,
    duration: 0.9,
  },
  bow: {
    label: 'Yay',
    cost: 22,
    damage: 30,
    range: 30,
    cosine: 0.98,
    hit: 0.48,
    duration: 1.05,
  },
});
export function segmentContact(x, z, tx, tz, cx, cz, radius = 0.65) {
  const dx = tx - x,
    dz = tz - z,
    l = dx * dx + dz * dz;
  const t = l
    ? Math.max(0, Math.min(1, ((cx - x) * dx + (cz - z) * dz) / l))
    : 0;
  return Math.hypot(x + t * dx - cx, z + t * dz - cz) <= radius ? t : null;
}
