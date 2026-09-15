import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_CLASSES,
  ARENA_MODES,
  applyArenaClass,
  classForSlot,
} from './arena.mjs';
test('arena classes define distinct Mount and Blade style roles', () => {
  assert.equal(ARENA_CLASSES.knight.weapon, 'sword');
  assert.equal(ARENA_CLASSES.lancer.weapon, 'spear');
  assert.equal(ARENA_CLASSES.archer.weapon, 'bow');
  assert.ok(ARENA_CLASSES.knight.health > ARENA_CLASSES.archer.health);
  assert.ok(ARENA_CLASSES.archer.speed > ARENA_CLASSES.knight.speed);
});
test('class application resets combat resources without changing map position', () => {
  const a = { x: 7, z: -3, health: 1, stamina: 0 };
  applyArenaClass(a, 'archer');
  assert.deepEqual([a.x, a.z], [7, -3]);
  assert.equal(a.health, 115);
  assert.equal(a.weapon, 'bow');
  assert.equal(a.maxStamina, 165);
});
test('arena mode constants preserve current team battle', () => {
  assert.equal(ARENA_MODES.teamDeathmatch.scoreLimit, 15);
  assert.equal(ARENA_MODES.duel.rounds, 3);
  assert.equal(classForSlot(4), 'lancer');
});
