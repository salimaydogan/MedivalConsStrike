import { WEAPONS } from './weapons.mjs';

export const ATTACK_DIRECTIONS = ['right', 'left', 'overhead', 'thrust'];
export function attackDirection(x, y) {
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y < 0 ? 'overhead' : 'thrust');
}
export function meleeProfile(weapon, direction = 'right') {
  const base = WEAPONS[weapon];
  if (weapon === 'spear') {
    if (direction === 'thrust') return { ...base, range: 4.5, cosine: 0.94 };
    if (direction === 'overhead') return { ...base, range: 3.7, cosine: 0.62, damage: 38 };
    return { ...base, range: 3.8, cosine: 0.5, damage: 34 };
  }
  if (weapon !== 'sword') return base;
  if (direction === 'thrust') return { ...base, range: 3, cosine: 0.9, damage: 30 };
  if (direction === 'overhead') return { ...base, cosine: 0.85, damage: 39 };
  return base;
}
