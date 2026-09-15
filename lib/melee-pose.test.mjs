import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Euler } from 'three';
import { meleePose } from './melee-pose.mjs';
const tip = (t) => {
  const p = meleePose('sword', t);
  return new Vector3(0, -1.5, 0).applyEuler(new Euler(p.x, p.y, p.z, 'YXZ'));
};
test('sword cuts from upper right to lower left in front of the fighter', () => {
  const a = tip(0.14),
    b = tip(0.34);
  assert.ok(a.x > 0 && b.x < 0);
  assert.ok(a.y > b.y);
  assert.ok(a.z < 0 && b.z < 0);
});
test('spear thrust changes reach without changing vertical angle', () => {
  const rest = meleePose('spear', -1),
    contact = meleePose('spear', 0.34);
  assert.equal(rest.x, contact.x);
  assert.equal(contact.x, Math.PI / 2);
  assert.ok(contact.thrust > 0.5);
  assert.equal(meleePose('spear', 0.9).thrust, 0);
});
test('spear sweep directions move the shaft across the front', () => {
  const left = meleePose('spear', 0.3, 'left');
  const right = meleePose('spear', 0.3, 'right');
  assert.ok(left.y < 0 && right.y > 0);
  assert.ok(meleePose('spear', 0.34, 'thrust').thrust > left.thrust);
});
