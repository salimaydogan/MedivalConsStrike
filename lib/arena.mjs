export const ARENA_CLASSES = Object.freeze({
  knight: Object.freeze({
    label: 'Şövalye',
    description: 'Kılıç ve kalkan. Yakın dövüşte dayanıklı.',
    weapon: 'sword',
    health: 145,
    stamina: 150,
    armor: 0.92,
    speed: 1,
  }),
  lancer: Object.freeze({
    label: 'Mızraklı',
    description: 'Uzun erişimli mızrak. At üstünde güçlü.',
    weapon: 'spear',
    health: 130,
    stamina: 160,
    armor: 1,
    speed: 1.02,
  }),
  archer: Object.freeze({
    label: 'Okçu',
    description: 'Yay ve ok. Mesafeyi koruyup destek verir.',
    weapon: 'bow',
    health: 115,
    stamina: 165,
    armor: 1.08,
    speed: 1.06,
  }),
});

export const ARENA_MODES = Object.freeze({
  teamDeathmatch: Object.freeze({
    label: 'Takım savaşı',
    scoreLimit: 15,
    rounds: 1,
  }),
  duel: Object.freeze({ label: 'Arena düellosu', scoreLimit: 3, rounds: 3 }),
});

export function applyArenaClass(actor, classId = 'knight') {
  const profile = ARENA_CLASSES[classId] ?? ARENA_CLASSES.knight;
  actor.classId = ARENA_CLASSES[classId] ? classId : 'knight';
  actor.weapon = profile.weapon;
  actor.maxHealth = profile.health;
  actor.maxStamina = profile.stamina;
  actor.health = profile.health;
  actor.stamina = profile.stamina;
  actor.armor = profile.armor;
  actor.classSpeed = profile.speed;
  return actor;
}

export function classForSlot(slot) {
  return ['knight', 'lancer', 'archer'][slot % 3];
}
