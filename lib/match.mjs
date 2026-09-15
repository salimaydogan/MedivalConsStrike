import { WEAPONS, segmentContact } from './weapons.mjs';
import { stepPlayerMotion } from './player-motion.mjs';
import { WORLD_SOLIDS, isFree } from './world.mjs';
import { inArc } from './combat.mjs';
import { clearStrike } from './training-combat.mjs';
import { dodgeDirection } from './dodge.mjs';
import { applyArenaClass, classForSlot } from './arena.mjs';
import { ATTACK_DIRECTIONS, meleeProfile } from './directional-combat.mjs';
import { bowSpread, shotDeviation } from './bow-aim.mjs';

export const MATCH_RULES = Object.freeze({
  teamSize: 2,
  duration: 300,
  scoreLimit: 15,
  respawn: 4,
  protection: 2,
});
export const JUMP_RULES = Object.freeze({ cost: 18, speed: 7, gravity: 20 });
const spawn = (team, slot) => ({
  x: ((slot % 5) - 2) * 2.5,
  z: team === 'blue' ? 23 : -23,
  heading: team === 'blue' ? 0 : Math.PI,
});
function fighter(id, team, slot, bot = true, name = '') {
  const actor = {
    id,
    team,
    slot,
    bot,
    name: name || `Bot ${slot + 1}`,
    ...spawn(team, slot),
    vx: 0,
    vz: 0,
    contactVx: 0,
    contactVz: 0,
    speed: 0,
    steering: 0,
    health: 100,
    stamina: 100,
    active: true,
    mounted: false,
    horseId: -1,
    classId: bot ? classForSlot(slot) : 'knight',
    weapon: 'sword',
    maxHealth: 100,
    maxStamina: 100,
    armor: 1,
    classSpeed: 1,
    blocking: false,
    attackTime: -1,
    attackOffset: 0,
    attackDirection: 'thrust',
    meleeManual: false,
    meleeReleased: false,
    stagger: 0,
    guardAge: 0,
    parryCooldown: 0,
    parryReady: false,
    bowCharge: 0,
    bowManual: false,
    hitChecked: false,
    regenDelay: 0,
    dodgeLeft: 0,
    dodgeX: 0,
    dodgeZ: 0,
    dodgeCooldown: 0,
    jumpHeight: 0,
    jumpVelocity: 0,
    respawn: 0,
    protection: 2,
    kills: 0,
    deaths: 0,
    attackCooldown: slot * 0.13,
    flash: 0,
    navTime: 0,
    path: [],
    gait: 0,
  };
  applyArenaClass(actor, bot ? classForSlot(slot) : 'knight');
  return actor;
}
export function createMatch(options = {}) {
  const teamSize = options.teamSize === 5 ? 5 : 2;
  /** @type {ReturnType<typeof fighter>[]} */
  const actors = [];
  /** @type {{type:string,id:string,by?:string,damage?:number,x?:number,z?:number,weapon?:string}[]} */
  const events = [];
  const m = {
    rules: { ...MATCH_RULES, teamSize },
    elapsed: 0,
    phase: 'playing',
    score: { blue: 0, red: 0 },
    actors,
    horses: Array.from({ length: teamSize === 2 ? 1 : 2 }, (_, id) => ({
      id,
      x: teamSize === 2 ? 0 : id === 0 ? -8 : 8,
      z: 0,
      heading: 0,
      rider: '',
    })),
    projectiles:
      /** @type {{id:number,owner:string,team:string,x:number,z:number,vx:number,vz:number,left:number,damage?:number}[]} */ ([]),
    nextProjectile: 0,
    events,
  };
  for (const team of ['blue', 'red'])
    for (let slot = 0; slot < teamSize; slot++)
      m.actors.push(fighter(`${team}-${slot}`, team, slot));
  return m;
}
// Used by local matches now; future room transport must authenticate the human id.
export function joinMatch(
  m,
  id,
  team = 'blue',
  name = 'Oyuncu',
  classId = 'knight',
) {
  if (
    typeof id !== 'string' ||
    !id ||
    id.length > 64 ||
    !['blue', 'red'].includes(team)
  )
    throw Error('Invalid player');
  if (m.actors.some((a) => a.id === id && !a.bot))
    throw Error('Player already joined');
  const index = m.actors.findIndex((a) => a.team === team && a.bot);
  if (index < 0) throw Error('Team full');
  const old = m.actors[index];
  m.actors[index] = fighter(
    id,
    team,
    old.slot,
    false,
    String(name).slice(0, 24),
  );
  applyArenaClass(m.actors[index], classId);
  return m.actors[index];
}
export function leaveMatch(m, id) {
  const index = m.actors.findIndex((a) => a.id === id && !a.bot);
  if (index < 0) return;
  const a = m.actors[index];
  releaseHorse(m, a);
  m.actors[index] = {
    ...a,
    id: `${a.team}-${a.slot}`,
    bot: true,
    name: `Bot ${a.slot + 1}`,
    path: [],
    navTime: 0,
  };
}
export function releaseHorse(m, a) {
  const horse = m.horses.find((h) => h.rider === a.id);
  if (horse) {
    horse.rider = '';
    horse.x = a.x;
    horse.z = a.z;
    horse.heading = a.heading;
  }
  a.mounted = false;
  a.horseId = -1;
  a.speed = 0;
}
export function toggleHorse(m, a) {
  if (a.health <= 0 || a.attackTime >= 0 || a.blocking || a.dodgeLeft > 0)
    return false;
  if (a.mounted) {
    for (const side of [-1, 1]) {
      const x = a.x + Math.cos(a.heading) * side * 2,
        z = a.z - Math.sin(a.heading) * side * 2;
      if (isFree(x, z, 0.48, WORLD_SOLIDS)) {
        releaseHorse(m, a);
        a.x = x;
        a.z = z;
        a.vx = a.vz = 0;
        return true;
      }
    }
    return false;
  }
  const horse = m.horses.find(
    (h) => !h.rider && Math.hypot(h.x - a.x, h.z - a.z) < 3.5,
  );
  if (!horse) return false;
  horse.rider = a.id;
  a.horseId = horse.id;
  a.mounted = true;
  a.x = horse.x;
  a.z = horse.z;
  a.heading = horse.heading;
  a.speed = 0;
  a.vx = a.vz = 0;
  return true;
}
function damageActor(m, a, victim, damage, originX = a.x, originZ = a.z, projectile = false) {
  const facing = inArc(
    victim.x,
    victim.z,
    victim.heading,
    originX,
    originZ,
    100,
    0.25,
  );
  if (victim.blocking && victim.stamina >= 18 && facing && (!projectile || victim.weapon === 'sword')) {
    const parry = !projectile && victim.parryReady && victim.guardAge <= 0.18;
    victim.stamina -= parry ? 6 : 18;
    victim.parryReady = false;
    if (parry) {
      a.stagger = 0.32;
      a.attackTime = -1;
    }
    victim.regenDelay = 0.8;
    m.events.push({
      type: parry ? 'parry' : 'block',
      id: victim.id,
      by: a.id,
      x: victim.x,
      z: victim.z,
    });
    return;
  }
  victim.health = Math.max(
    0,
    victim.health - Math.round(damage * victim.armor),
  );
  victim.flash = 0.35;
  victim.stagger = 0.22;
  victim.attackTime = -1;
  m.events.push({
    type: 'hit',
    id: victim.id,
    by: a.id,
    damage: Math.round(damage * victim.armor),
    x: victim.x,
    z: victim.z,
  });
  if (victim.health === 0) {
    victim.deaths++;
    a.kills++;
    m.score[a.team]++;
    victim.respawn = m.rules.respawn;
    victim.attackTime = -1;
    victim.blocking = false;
    victim.dodgeLeft = 0;
    victim.vx = victim.vz = victim.speed = 0;
    releaseHorse(m, victim);
    m.events.push({ type: 'kill', id: victim.id, by: a.id });
  }
}
// Small fixed grid: cached per bot, shortest walkable path around courtyard cover.
export function findPath(x, z, tx, tz) {
  const cell = (v) => Math.max(0, Math.min(28, Math.round((v + 28) / 2))),
    key = (a, b) => a + 29 * b;
  const sx = cell(x),
    sz = cell(z),
    gx = cell(tx),
    gz = cell(tz),
    goal = key(gx, gz),
    start = key(sx, sz);
  const queue = [start],
    parents = new Map([[start, -1]]);
  let head = 0;
  while (head < queue.length) {
    const k = queue[head++];
    if (k === goal) break;
    const a = k % 29,
      b = Math.floor(k / 29);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = a + dx,
        nz = b + dz,
        nk = key(nx, nz);
      if (
        nx < 0 ||
        nx > 28 ||
        nz < 0 ||
        nz > 28 ||
        parents.has(nk) ||
        !isFree(nx * 2 - 28, nz * 2 - 28, 0.65, WORLD_SOLIDS)
      )
        continue;
      parents.set(nk, k);
      queue.push(nk);
    }
  }
  if (!parents.has(goal)) return [];
  const path = [];
  for (let k = goal; k !== start; k = parents.get(k))
    path.push({ x: (k % 29) * 2 - 28, z: Math.floor(k / 29) * 2 - 28 });
  return path.reverse();
}
function botInput(a, m, dt) {
  const enemy = m.actors
    .filter((b) => b.team !== a.team && b.health > 0)
    .sort(
      (b, c) =>
        Math.hypot(b.x - a.x, b.z - a.z) - Math.hypot(c.x - a.x, c.z - a.z),
    )[0];
  if (!enemy) return {};
  const distance = Math.hypot(enemy.x - a.x, enemy.z - a.z);
  a.navTime -= dt;
  let aim = enemy;
  if (
    !clearStrike(a.x, a.z, enemy.x, enemy.z) ||
    !clearStrike(a.x + 0.6, a.z, enemy.x + 0.6, enemy.z)
  ) {
    if (a.navTime <= 0) {
      a.path = findPath(a.x, a.z, enemy.x, enemy.z);
      a.navTime = 0.8;
    }
    while (
      a.path.length &&
      Math.hypot(a.path[0].x - a.x, a.path[0].z - a.z) < 0.8
    )
      a.path.shift();
    if (a.path.length) aim = a.path[0];
  } else a.path = [];
  const yaw = Math.atan2(a.x - aim.x, a.z - aim.z);
  const desired = a.weapon === 'bow' ? 12 : a.weapon === 'spear' ? 3.4 : 1.9;
  const guard =
    distance < 3 &&
    enemy.attackTime > 0.1 &&
    enemy.attackTime < 0.32 &&
    Math.floor(m.elapsed + a.slot) % 3 === 0;
  return {
    forward:
      distance > desired ? 1 : a.weapon === 'bow' && distance < 7 ? -1 : 0,
    side: 0,
    yaw,
    sprint: distance > 7,
    guard,
    attack:
      distance < WEAPONS[a.weapon].range &&
      clearStrike(a.x, a.z, enemy.x, enemy.z) &&
      !guard &&
      a.attackCooldown <= 0,
  };
}
export function stepMatch(m, inputs = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.04)
    throw Error('Invalid match tick');
  m.events = [];
  if (m.phase !== 'playing') return m;
  m.elapsed = Math.min(m.rules.duration, m.elapsed + dt);
  // Stable rotating attack order avoids always favoring the first team.
  const actors = m.actors;
  for (const a of actors) {
    a.flash = Math.max(0, a.flash - dt);
    if (a.health <= 0) {
      a.respawn = Math.max(0, a.respawn - dt);
      if (a.respawn === 0) {
        Object.assign(a, spawn(a.team, a.slot), {
          health: a.maxHealth,
          stamina: a.maxStamina,
          vx: 0,
          vz: 0,
          speed: 0,
          blocking: false,
          attackTime: -1,
          stagger: 0,
          guardAge: 0,
          parryCooldown: 0,
          parryReady: false,
          regenDelay: 0,
          dodgeLeft: 0,
          dodgeCooldown: 0,
          jumpHeight: 0,
          jumpVelocity: 0,
          protection: m.rules.protection,
          path: [],
          navTime: 0,
        });
        m.events.push({ type: 'respawn', id: a.id });
      }
      continue;
    }
    a.protection = Math.max(0, a.protection - dt);
    a.attackCooldown = Math.max(0, a.attackCooldown - dt);
    a.dodgeCooldown = Math.max(0, a.dodgeCooldown - dt);
    a.regenDelay = Math.max(0, a.regenDelay - dt);
    a.stagger = Math.max(0, a.stagger - dt);
    a.parryCooldown = Math.max(0, a.parryCooldown - dt);
    const input = a.bot ? botInput(a, m, dt) : inputs[a.id] || {};
    if (
      input.jump &&
      !a.mounted &&
      a.jumpHeight === 0 &&
      a.stagger === 0 &&
      a.dodgeLeft === 0 &&
      a.attackTime < 0 &&
      !a.blocking &&
      a.stamina >= JUMP_RULES.cost
    ) {
      a.jumpVelocity = JUMP_RULES.speed;
      a.stamina -= JUMP_RULES.cost;
      a.regenDelay = 0.7;
      m.events.push({ type: 'jump', id: a.id });
    }
    if (a.jumpHeight > 0 || a.jumpVelocity > 0) {
      a.jumpVelocity -= JUMP_RULES.gravity * dt;
      a.jumpHeight = Math.max(0, a.jumpHeight + a.jumpVelocity * dt);
      if (a.jumpHeight === 0) a.jumpVelocity = 0;
    }
    if (
      input.weapon &&
      Object.hasOwn(WEAPONS, input.weapon) &&
      a.attackTime < 0 &&
      !a.blocking
    )
      a.weapon = input.weapon;
    if (input.mount) toggleHorse(m, a);
    const weapon = meleeProfile(a.weapon, a.attackDirection);
    const preparing = a.attackTime >= 0 && !a.hitChecked &&
      ((a.meleeManual && !a.meleeReleased) || a.bowManual);
    if (preparing && (input.cancelAttack || input.guard)) {
      a.attackTime = -1;
      a.meleeManual = false;
      a.bowManual = false;
      a.bowCharge = 0;
      // Starting stamina is intentionally not refunded: feints have a cost.
      a.regenDelay = Math.max(a.regenDelay, 0.55);
      m.events.push({ type: 'feint', id: a.id });
    }
    const wasBlocking = a.blocking;
    a.blocking =
      !!input.guard &&
      a.weapon !== 'bow' &&
      a.attackTime < 0 &&
      a.jumpHeight === 0 &&
      a.dodgeLeft === 0 &&
      a.stagger === 0 &&
      a.stamina > 0;
    if (a.blocking && !wasBlocking) {
      a.guardAge = 0;
      a.parryReady = a.parryCooldown === 0;
      a.parryCooldown = 0.6;
    }
    a.guardAge = a.blocking ? a.guardAge + dt : 0;
    if (!a.blocking) a.parryReady = false;
    if (
      input.dodge &&
      a.stagger === 0 &&
      !a.mounted &&
      a.jumpHeight === 0 &&
      a.dodgeCooldown === 0 &&
      a.attackTime < 0 &&
      a.stamina >= 25
    ) {
      const d = dodgeDirection(
        input.side || 0,
        input.forward || 0,
        input.yaw || 0,
      );
      a.dodgeX = d.x;
      a.dodgeZ = d.z;
      a.dodgeLeft = 0.28;
      a.dodgeCooldown = 0.85;
      a.stamina -= 25;
      a.regenDelay = 1;
      a.blocking = false;
    }
    if (
      input.attack &&
      !input.cancelAttack &&
      a.stagger === 0 &&
      a.dodgeLeft === 0 &&
      a.jumpHeight === 0 &&
      a.stamina >= weapon.cost &&
      a.attackTime < 0 &&
      !a.blocking
    ) {
      a.attackTime = 0;
      a.attackDirection = ATTACK_DIRECTIONS.includes(input.attackDirection)
        ? input.attackDirection
        : a.weapon === 'spear' ? 'thrust' : 'right';
      a.meleeManual = a.weapon !== 'bow' && typeof input.attackHeld === 'boolean';
      a.meleeReleased = false;
      a.bowCharge = 0;
      a.bowManual = a.weapon === 'bow' && typeof input.attackHeld === 'boolean';
      // Capture rider aim at windup, so moving the camera cannot redirect a strike.
      a.attackOffset = a.mounted && a.weapon !== 'bow' && Number.isFinite(input.yaw)
        ? Math.max(-Math.PI / 2, Math.min(Math.PI / 2,
            Math.atan2(Math.sin(input.yaw - a.heading), Math.cos(input.yaw - a.heading))))
        : 0;
      a.hitChecked = false;
      a.stamina -= weapon.cost;
      a.regenDelay = 0.9;
      a.attackCooldown = 1.1 + a.slot * 0.07;
      a.protection = 0;
      if (!a.mounted && a.weapon === 'bow')
        a.heading = Number.isFinite(input.yaw) ? input.yaw : a.heading;
      m.events.push({ type: 'swing', id: a.id, weapon: a.weapon });
    }
    if (a.blocking) {
      a.stamina = Math.max(0, a.stamina - dt * 9);
      a.regenDelay = 0.55;
      if (a.stamina === 0) a.blocking = false;
    } else if (a.attackTime < 0 && a.regenDelay === 0)
      a.stamina = Math.min(a.maxStamina, a.stamina + 24 * dt);
    const motion = stepPlayerMotion(
      { ...a, attacking: a.attackTime >= 0 },
      a.stagger > 0 ? { ...input, forward: 0, side: 0, sprint: false } : input,
      dt,
      WORLD_SOLIDS,
    );
    if (a.attackTime >= 0 && !a.mounted) motion.heading = a.heading;
    if (a.bowManual && !a.hitChecked && !a.mounted && Number.isFinite(input.yaw)) motion.heading = input.yaw;
    motion.contactVx = (motion.x - a.x) / dt;
    motion.contactVz = (motion.z - a.z) / dt;
    Object.assign(a, motion);
    a.gait += motion.moved * (a.mounted ? 2.4 : 3.7);
    if (a.mounted) {
      const h = m.horses.find((h) => h.id === a.horseId);
      if (h) {
        h.x = a.x;
        h.z = a.z;
        h.heading = a.heading;
      }
    }
    if (a.attackTime >= 0) {
      if (a.bowManual && !a.hitChecked) {
        a.bowCharge = Math.min(1, a.bowCharge + dt / 0.8);
        a.attackTime = input.attackHeld
          ? Math.min(weapon.hit - 0.001, a.attackTime + dt)
          : weapon.hit;
      } else if (a.meleeManual && !a.meleeReleased) {
        // Finish the windup even after a quick tap; holding never causes a hit.
        if (input.attackHeld && ATTACK_DIRECTIONS.includes(input.attackDirection))
          a.attackDirection = input.attackDirection;
        a.attackTime = Math.min(0.14, a.attackTime + dt);
        if (!input.attackHeld && a.attackTime >= 0.14) a.meleeReleased = true;
      } else a.attackTime += dt;
    }
  }
  const offset = Math.floor(m.elapsed * 60) % actors.length;
  for (let i = 0; i < actors.length; i++) {
    const a = actors[(i + offset) % actors.length];
    if (a.health <= 0 || a.attackTime < 0) continue;
    const weapon = meleeProfile(a.weapon, a.attackDirection);
    if (!a.hitChecked && a.attackTime >= weapon.hit) {
      a.hitChecked = true;
      if (a.weapon === 'bow') {
        const power = a.bowManual ? 0.3 + 0.7 * a.bowCharge : 1;
        const spread = bowSpread(a.bowManual ? a.bowCharge : 1,
          Math.hypot(a.contactVx || 0, a.contactVz || 0), a.mounted);
        const shotHeading = a.heading + a.attackOffset + shotDeviation(m.nextProjectile + 1, spread);
        m.projectiles.push({
          id: ++m.nextProjectile,
          owner: a.id,
          team: a.team,
          x: a.x,
          z: a.z,
          vx: -Math.sin(shotHeading) * 24 * power,
          vz: -Math.cos(shotHeading) * 24 * power,
          damage: Math.round(WEAPONS.bow.damage * power),
          left: 1.25,
        });
        m.events.push({ type: 'release', id: a.id, weapon: 'bow' });
      } else {
        const victim = actors
          .filter(
            (b) =>
              b.team !== a.team &&
              b.health > 0 &&
              b.protection === 0 &&
              inArc(
                a.x,
                a.z,
                a.heading + a.attackOffset,
                b.x,
                b.z,
                weapon.range + (a.mounted ? 0.6 : 0),
                weapon.cosine,
              ) &&
              clearStrike(a.x, a.z, b.x, b.z),
          )
          .sort(
            (b, c) =>
              Math.hypot(b.x - a.x, b.z - a.z) -
              Math.hypot(c.x - a.x, c.z - a.z),
          )[0];
        if (victim)
          damageActor(
            m,
            a,
            victim,
            weapon.damage +
              (a.mounted
                ? mountedImpactBonus(a, victim)
                : 0),
          );
      }
    }
    if (a.attackTime >= weapon.duration) a.attackTime = -1;
    if (
      m.score.blue >= m.rules.scoreLimit ||
      m.score.red >= m.rules.scoreLimit
    ) {
      m.phase = 'finished';
      break;
    }
  }
  if (m.phase === 'playing')
    for (const arrow of m.projectiles) {
      const x = arrow.x + arrow.vx * dt,
        z = arrow.z + arrow.vz * dt;
      const owner = actors.find((a) => a.id === arrow.owner);
      if (!owner) {
        arrow.left = 0;
        continue;
      }
      const contacts = actors
        .filter(
          (a) => a.team !== arrow.team && a.health > 0 && a.protection === 0,
        )
        .map((a) => ({
          a,
          t: segmentContact(
            arrow.x,
            arrow.z,
            x,
            z,
            a.x,
            a.z,
            a.mounted ? 0.95 : 0.65,
          ),
        }))
        .filter((c) => c.t !== null)
        .sort((a, b) => a.t - b.t);
      const contact = contacts[0];
      if (
        contact &&
        clearStrike(
          arrow.x,
          arrow.z,
          arrow.x + (x - arrow.x) * contact.t,
          arrow.z + (z - arrow.z) * contact.t,
        )
      ) {
        damageActor(
          m,
          owner,
          contact.a,
          arrow.damage ?? WEAPONS.bow.damage,
          arrow.x - arrow.vx,
          arrow.z - arrow.vz,
          true,
        );
        arrow.left = 0;
      } else if (!clearStrike(arrow.x, arrow.z, x, z)) {
        arrow.left = 0;
        m.events.push({
          type: 'impact',
          id: arrow.owner,
          x: arrow.x,
          z: arrow.z,
        });
      }
      arrow.x = x;
      arrow.z = z;
      arrow.left -= dt;
      if (
        m.score.blue >= m.rules.scoreLimit ||
        m.score.red >= m.rules.scoreLimit
      ) {
        m.phase = 'finished';
        break;
      }
    }
  m.projectiles = m.projectiles.filter((p) => p.left > 0);
  if (m.elapsed >= m.rules.duration) m.phase = 'finished';
  return m;
}

export function mountedImpactBonus(a, victim) {
  const distance = Math.hypot(victim.x - a.x, victim.z - a.z);
  if (!distance) return 0;
  const closing = ((a.contactVx - victim.contactVx) * (victim.x - a.x)
    + (a.contactVz - victim.contactVz) * (victim.z - a.z)) / distance;
  return Math.round(Math.min(13, Math.max(0, closing || 0)) * 1.4);
}
