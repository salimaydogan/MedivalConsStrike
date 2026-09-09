import { stepPlayerMotion } from './player-motion.mjs';
import { WORLD_SOLIDS, isFree } from './world.mjs';
import { canAttack, inArc, ATTACK_DURATION, HIT_TIME } from './combat.mjs';
import { clearStrike } from './training-combat.mjs';
import { dodgeDirection } from './dodge.mjs';

export const MATCH_RULES = Object.freeze({
  teamSize: 2,
  duration: 300,
  scoreLimit: 15,
  respawn: 4,
  protection: 2,
});
const spawn = (team, slot) => ({
  x: ((slot % 5) - 2) * 2.5,
  z: team === 'blue' ? 23 : -23,
  heading: team === 'blue' ? 0 : Math.PI,
});
function fighter(id, team, slot, bot = true, name = '') {
  return {
    id,
    team,
    slot,
    bot,
    name: name || `Bot ${slot + 1}`,
    ...spawn(team, slot),
    vx: 0,
    vz: 0,
    speed: 0,
    steering: 0,
    health: 100,
    stamina: 100,
    active: true,
    mounted: false,
    blocking: false,
    attackTime: -1,
    hitChecked: false,
    regenDelay: 0,
    dodgeLeft: 0,
    dodgeX: 0,
    dodgeZ: 0,
    dodgeCooldown: 0,
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
}
export function createMatch(options = {}) {
  const teamSize = options.teamSize === 5 ? 5 : 2;
  /** @type {ReturnType<typeof fighter>[]} */
  const actors = [];
  /** @type {{type:string,id:string,by?:string,damage?:number}[]} */
  const events = [];
  const m = {
    rules: { ...MATCH_RULES, teamSize },
    elapsed: 0,
    phase: 'playing',
    score: { blue: 0, red: 0 },
    actors,
    events,
  };
  for (const team of ['blue', 'red'])
    for (let slot = 0; slot < teamSize; slot++)
      m.actors.push(fighter(`${team}-${slot}`, team, slot));
  return m;
}
// Used by local matches now; future room transport must authenticate the human id.
export function joinMatch(m, id, team = 'blue', name = 'Oyuncu') {
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
  return m.actors[index];
}
export function leaveMatch(m, id) {
  const index = m.actors.findIndex((a) => a.id === id && !a.bot);
  if (index < 0) return;
  const a = m.actors[index];
  m.actors[index] = {
    ...a,
    id: `${a.team}-${a.slot}`,
    bot: true,
    name: `Bot ${a.slot + 1}`,
    path: [],
    navTime: 0,
  };
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
  const guard =
    distance < 3 &&
    enemy.attackTime > 0.1 &&
    enemy.attackTime < 0.32 &&
    Math.floor(m.elapsed + a.slot) % 3 === 0;
  return {
    forward: distance > 1.9 ? 1 : 0,
    side: 0,
    yaw,
    sprint: distance > 7,
    guard,
    attack: distance < 2.5 && !guard && a.attackCooldown <= 0,
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
          health: 100,
          stamina: 100,
          vx: 0,
          vz: 0,
          speed: 0,
          blocking: false,
          attackTime: -1,
          regenDelay: 0,
          dodgeLeft: 0,
          dodgeCooldown: 0,
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
    const input = a.bot ? botInput(a, m, dt) : inputs[a.id] || {};
    a.blocking =
      !!input.guard && a.attackTime < 0 && a.dodgeLeft === 0 && a.stamina > 0;
    if (
      input.dodge &&
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
      a.dodgeLeft === 0 &&
      canAttack(a.stamina, a.attackTime >= 0, a.blocking, false)
    ) {
      a.attackTime = 0;
      a.hitChecked = false;
      a.stamina -= 24;
      a.regenDelay = 0.9;
      a.attackCooldown = 1.1 + a.slot * 0.07;
      a.protection = 0;
      a.heading = Number.isFinite(input.yaw) ? input.yaw : a.heading;
      m.events.push({ type: 'swing', id: a.id });
    }
    if (a.blocking) {
      a.stamina = Math.max(0, a.stamina - dt * 9);
      a.regenDelay = 0.55;
      if (a.stamina === 0) a.blocking = false;
    } else if (a.attackTime < 0 && a.regenDelay === 0)
      a.stamina = Math.min(100, a.stamina + 24 * dt);
    const motion = stepPlayerMotion(
      { ...a, attacking: a.attackTime >= 0 },
      input,
      dt,
      WORLD_SOLIDS,
    );
    Object.assign(a, motion);
    a.gait += motion.moved * 3.7;
    if (a.attackTime >= 0) a.attackTime += dt;
  }
  const offset = Math.floor(m.elapsed * 60) % actors.length;
  for (let i = 0; i < actors.length; i++) {
    const a = actors[(i + offset) % actors.length];
    if (a.health <= 0 || a.attackTime < 0) continue;
    if (!a.hitChecked && a.attackTime >= HIT_TIME) {
      a.hitChecked = true;
      const victim = actors
        .filter(
          (b) =>
            b.team !== a.team &&
            b.health > 0 &&
            b.protection === 0 &&
            inArc(a.x, a.z, a.heading, b.x, b.z) &&
            clearStrike(a.x, a.z, b.x, b.z),
        )
        .sort(
          (b, c) =>
            Math.hypot(b.x - a.x, b.z - a.z) - Math.hypot(c.x - a.x, c.z - a.z),
        )[0];
      if (victim) {
        const block =
          victim.blocking &&
          victim.stamina >= 18 &&
          inArc(victim.x, victim.z, victim.heading, a.x, a.z, 3, 0.25);
        if (block) {
          victim.stamina -= 18;
          victim.regenDelay = 0.8;
          m.events.push({ type: 'block', id: victim.id, by: a.id });
        } else {
          victim.health = Math.max(0, victim.health - 34);
          victim.flash = 0.35;
          m.events.push({ type: 'hit', id: victim.id, by: a.id, damage: 34 });
          if (victim.health === 0) {
            victim.deaths++;
            a.kills++;
            m.score[a.team]++;
            victim.respawn = m.rules.respawn;
            victim.attackTime = -1;
            victim.blocking = false;
            victim.dodgeLeft = 0;
            victim.vx = victim.vz = victim.speed = 0;
            m.events.push({ type: 'kill', id: victim.id, by: a.id });
          }
        }
      }
    }
    if (a.attackTime >= ATTACK_DURATION) a.attackTime = -1;
    if (
      m.score.blue >= m.rules.scoreLimit ||
      m.score.red >= m.rules.scoreLimit
    ) {
      m.phase = 'finished';
      break;
    }
  }
  if (m.elapsed >= m.rules.duration) m.phase = 'finished';
  return m;
}
