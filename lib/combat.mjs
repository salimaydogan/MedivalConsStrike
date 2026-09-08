export const ATTACK_COST = 24;
export const ATTACK_DURATION = .68;
export const HIT_TIME = .24;
export const attackCost = mounted => mounted ? 32 : ATTACK_COST;
export const mountedDamage = speed => 34 + Math.round(Math.min(13, Math.max(0, speed)) / 13 * 26);
export function inMountedReach(x,z,heading,tx,tz) {
  const dx=tx-x,dz=tz-z;
  const right=dx*Math.cos(heading)-dz*Math.sin(heading);
  const forward=-dx*Math.sin(heading)-dz*Math.cos(heading);
  return Math.hypot(dx,dz)<=3.2 && right>=.65 && forward>=-.8 && forward<=2.6;
}
// The arm points down in its rest pose. Positive X rotates it toward local -Z (forward).
export function swordAngle(time) {
  if (time < .16) return .35 + (time / .16) * 2.25;
  if (time < .32) return 2.6 - ((time - .16) / .16) * 1.7;
  return Math.max(0, .9 * (1 - (time - .32) / (ATTACK_DURATION - .32)));
}
export function canAttack(stamina, attacking, blocking, mounted) {
  return stamina >= attackCost(mounted) && !attacking && !blocking;
}
export function inArc(x, z, heading, tx, tz, range = 2.6, cosine = .5) {
  const dx=tx-x, dz=tz-z, distance=Math.hypot(dx,dz);
  return distance <= range && (distance < .001 || (-Math.sin(heading)*dx-Math.cos(heading)*dz)/distance >= cosine);
}
export function defend(stamina, blocking, facing) {
  const blocked=blocking && facing && stamina>=18;
  return { blocked, stamina: blocked?stamina-18:stamina, damage: blocked?0:15 };
}
