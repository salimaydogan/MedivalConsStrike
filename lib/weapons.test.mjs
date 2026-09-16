import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  stepMatch,
  toggleHorse,
  leaveMatch,
  joinMatch,
} from './match.mjs';
import { parseCommand } from '../server/rooms.mjs';
const setup = () => {
  const m = createMatch();
  m.actors.forEach((a, i) =>
    Object.assign(a, { bot: false, x: 20, z: 20 + i, protection: 0 }),
  );
  return m;
};
const advance = (m, n, input = {}) => {
  for (let i = 0; i < n; i++) stepMatch(m, input, 1 / 60);
};
test('each team has one base horse; occupancy remains exclusive', () => {
  assert.equal(createMatch().horses.length, 2);
  assert.equal(createMatch({ teamSize: 5 }).horses.length, 2);
  const m = setup(),
    [a, b] = m.actors;
  assert.ok(m.horses.find((horse) => horse.team === 'blue').z > 0);
  assert.ok(m.horses.find((horse) => horse.team === 'red').z < 0);
  Object.assign(a, { x: 6, z: 18 });
  Object.assign(b, { x: 6, z: 17 });
  assert.equal(toggleHorse(m, a), true);
  assert.equal(toggleHorse(m, b), false);
  assert.equal(toggleHorse(m, a), true);
  assert.equal(toggleHorse(m, b), true);
  assert.equal(m.horses.length, 2);
});
test('departing human releases horse without changing its count', () => {
  const m = createMatch();
  const a = joinMatch(m, 'human');
  Object.assign(a, { x: 6, z: 18 });
  toggleHorse(m, a);
  leaveMatch(m, 'human');
  assert.equal(m.horses[0].rider, '');
  advance(m, 5 * 60);
  assert.equal(m.horses[0].x, m.horses[0].homeX);
  assert.equal(m.horses[0].z, m.horses[0].homeZ);
  assert.equal(m.horses.length, 2);
});
test('sword and spear keep their facing during attack despite camera changes', () => {
  for (const weapon of ['sword', 'spear']) {
    const m = setup(),
      a = m.actors[0];
    Object.assign(a, { heading: 1, weapon });
    advance(m, 1, { [a.id]: { attack: true, yaw: 0 } });
    advance(m, 10, { [a.id]: { yaw: -2 } });
    assert.equal(a.heading, 1);
  }
});
test('spear hits beyond sword range and weapon cannot change mid-swing', () => {
  const m = setup(),
    a = m.actors[0],
    b = m.actors[2];
  Object.assign(a, { x: 0, z: 0, heading: 0 });
  Object.assign(b, { x: 0, z: -3.7 });
  advance(m, 1, { [a.id]: { weapon: 'spear', attack: true, yaw: 0 } });
  advance(m, 30, { [a.id]: { weapon: 'bow' } });
  assert.equal(a.weapon, 'spear');
  assert.equal(b.health, b.maxHealth - 40);
});
test('arrows travel over time, hit once and do not pass through cover', () => {
  for (const wall of [false, true]) {
    const m = setup(),
      a = m.actors[0],
      b = m.actors[2];
    Object.assign(a, {
      x: wall ? -18 : 0,
      z: wall ? -18 : 0,
      heading: Math.PI,
      weapon: 'bow',
    });
    Object.assign(b, { x: a.x, z: wall ? -8 : 10 });
    advance(m, 1, { [a.id]: { attack: true, yaw: Math.PI } });
    advance(m, 29);
    assert.equal(b.health, b.maxHealth);
    advance(m, 60);
    assert.equal(b.health, wall ? b.maxHealth : b.maxHealth - 28);
  }
});
test('wire commands validate weapon and mount and reject injected horse state', () => {
  const input = {
    type: 'move',
    sequence: 1,
    forward: 0,
    side: 0,
    yaw: 0,
    sprint: false,
    mount: true,
    weapon: 'bow',
  };
  assert.equal(parseCommand(input).mount, true);
  assert.throws(() => parseCommand({ ...input, weapon: 'cannon' }));
  assert.throws(() => parseCommand({ ...input, horseId: 0 }));
});
