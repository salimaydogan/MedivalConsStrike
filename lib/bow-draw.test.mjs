import test from 'node:test';
import assert from 'node:assert/strict';
import { bowDraw } from './bow-draw.mjs';
test('bow string draws before release and recoils immediately after', () => {
  assert.equal(bowDraw(-1), 0);
  assert.ok(bowDraw(0.3) > bowDraw(0.1));
  assert.equal(bowDraw(0.48), 1);
  assert.ok(bowDraw(0.52) < 0.5);
  assert.equal(bowDraw(0.6), 0);
});
