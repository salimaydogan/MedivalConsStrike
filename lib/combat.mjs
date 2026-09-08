export const ATTACK_COST = 24;
export const ATTACK_DURATION = .68;
export const HIT_TIME = .24;
export function canAttack(stamina, attacking, blocking, mounted) {
  return stamina >= ATTACK_COST && !attacking && !blocking && !mounted;
}
export function inArc(x, z, heading, tx, tz, range = 2.6, cosine = .5) {
  const dx=tx-x, dz=tz-z, distance=Math.hypot(dx,dz);
  return distance <= range && (distance < .001 || (-Math.sin(heading)*dx-Math.cos(heading)*dz)/distance >= cosine);
}
export function defend(stamina, blocking, facing) {
  const blocked=blocking && facing && stamina>=18;
  return { blocked, stamina: blocked?stamina-18:stamina, damage: blocked?0:15 };
}
