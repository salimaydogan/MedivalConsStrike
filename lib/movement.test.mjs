import test from 'node:test';
import assert from 'node:assert/strict';
import { horseMotion, approach, turnToward } from './movement.mjs';

test('horse acceleration is independent of frame rate', () => {
  const simulate = hz => { let s = 0; for(let i=0;i<hz*2;i++) s=horseMotion(s,0,1,0,true,1/hz).speed; return s; };
  assert.ok(Math.abs(simulate(30)-simulate(144))<.001);
  assert.ok(simulate(60)<13);
});
test('reverse input brakes before reversing and reverse is limited', () => {
  let s=10;
  for(let i=0;i<30;i++) s=horseMotion(s,0,-1,0,true,1/60).speed;
  assert.ok(s>0 && s<10);
  for(let i=0;i<240;i++) s=horseMotion(s,0,-1,0,true,1/60).speed;
  assert.equal(s,-2.2);
});
test('gallop has a wider turning circle and stopping settles exactly', () => {
  assert.ok(Math.abs(horseMotion(13,1,1,1,true,.01).turn)<Math.abs(horseMotion(7,1,1,1,false,.01).turn));
  assert.equal(approach(.01,0,10,1/60),0);
});
test('character facing crosses the angle seam by the short route', () => {
  const angle=turnToward(Math.PI-.01,-Math.PI+.01,12,.016);
  assert.ok(angle>Math.PI-.01 && angle<Math.PI+.01);
});
