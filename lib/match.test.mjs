import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  joinMatch,
  leaveMatch,
  stepMatch,
  findPath,
} from './match.mjs';
import { isFree, WORLD_SOLIDS } from './world.mjs';
const advance = (m, seconds, inputs = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++)
    stepMatch(m, inputs, 1 / 60);
  return m;
};
test('teams fill with bots and humans replace only their team slots', () => {
  for (const teamSize of [2, 5]) {
    const m = createMatch({ teamSize });
    joinMatch(m, 'human', 'red');
    assert.equal(m.actors.length, teamSize * 2);
    assert.equal(m.actors.filter((a) => a.bot).length, teamSize * 2 - 1);
    assert.equal(m.actors.find((a) => a.id === 'human').team, 'red');
    assert.throws(() => joinMatch(m, 'human', 'blue'));
    leaveMatch(m, 'human');
    assert.equal(m.actors.filter((a) => a.bot).length, teamSize * 2);
  }
});
test('full teams reject another player without changing roster', () => {
  const m = createMatch();
  joinMatch(m, 'a');
  joinMatch(m, 'b');
  assert.throws(() => joinMatch(m, 'c'));
  assert.equal(m.actors.length, 4);
});
test('bot-only matches move, score, respawn and finish at both team sizes', () => {
  for (const teamSize of [2, 5]) {
    const m = createMatch({ teamSize });
    advance(m, 301);
    assert.equal(m.phase, 'finished');
    assert.ok(m.score.blue + m.score.red > 0);
    assert.equal(
      m.actors.reduce((n, a) => n + a.deaths, 0),
      m.score.blue + m.score.red,
    );
    assert.ok(m.actors.every((a) => isFree(a.x, a.z, 0.48, WORLD_SOLIDS)));
    const snapshot = JSON.stringify({ ...m, events: [] });
    stepMatch(m);
    assert.equal(JSON.stringify(m), snapshot);
  }
});
test('one player can stay idle while bots complete a match', () => {
  const m = createMatch();
  joinMatch(m, 'local');
  advance(m, 301);
  assert.equal(m.phase, 'finished');
  assert.ok(m.score.red > 0);
  assert.ok(m.actors.find((a) => a.id === 'local').deaths > 0);
});
test('friendly attacks do not damage teammates; enemy hit scores once', () => {
  const m = createMatch();
  m.actors.forEach((a, i) =>
    Object.assign(a, { bot: false, x: 20, z: 20 + i, protection: 0 }),
  );
  const [a, friend, b] = m.actors;
  Object.assign(a, { x: 0, z: 0, heading: 0 });
  Object.assign(friend, { x: 0, z: -1 });
  Object.assign(b, { x: 0, z: -2, health: 34, armor: 1 });
  advance(m, 0.4, { [a.id]: { attack: true, yaw: 0 } });
  assert.equal(friend.health, friend.maxHealth);
  assert.equal(b.health, 0);
  assert.equal(m.score.blue, 1);
  assert.equal(b.deaths, 1);
  assert.equal(a.kills, 1);
});
test('respawn preserves score and gives temporary protection', () => {
  const m = createMatch();
  m.actors.forEach((a) => (a.bot = false));
  const a = m.actors[0];
  Object.assign(a, { health: 0, respawn: 0.01, kills: 3, deaths: 2 });
  stepMatch(m);
  assert.equal(a.health, a.maxHealth);
  assert.equal(a.kills, 3);
  assert.equal(a.deaths, 2);
  assert.equal(a.protection, 2);
});
test('jump spends stamina, rises, lands and cannot start while mounted', () => {
  const m = createMatch();
  m.actors.forEach((a) => (a.bot = false));
  const a = m.actors[0];
  const stamina = a.stamina;
  stepMatch(m, { [a.id]: { jump: true } });
  assert.ok(a.jumpHeight > 0);
  assert.ok(a.stamina < stamina);
  advance(m, 2);
  assert.equal(a.jumpHeight, 0);
  assert.equal(a.jumpVelocity, 0);
  Object.assign(a, { mounted: true, jumpHeight: 0, jumpVelocity: 0 });
  stepMatch(m, { [a.id]: { jump: true } });
  assert.equal(a.jumpHeight, 0);
});
test('navigation path goes around cover using walkable cells', () => {
  const path = findPath(-18, -18, -18, -8);
  assert.ok(path.length > 5);
  assert.ok(path.every((p) => isFree(p.x, p.z, 0.65, WORLD_SOLIDS)));
});
test('match tick rejects invalid time and supports deterministic replay', () => {
  const a = createMatch(),
    b = createMatch();
  for (const dt of [NaN, -1, 0, 1]) assert.throws(() => stepMatch(a, {}, dt));
  advance(a, 30);
  advance(b, 30);
  assert.deepEqual(a, b);
});
