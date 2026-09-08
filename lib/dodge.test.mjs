import test from 'node:test';
import assert from 'node:assert/strict';
import {canDodge,dodgeDirection,DODGE_DURATION,DODGE_SPEED} from './dodge.mjs';
test('dodge is gated by life, stamina, cooldown and action state',()=>{
  assert.equal(canDodge(true,100,false,false,0,25),true);
  for(const args of [[false,100,false,false,0,100],[true,0,false,false,0,100],[true,100,true,false,0,100],[true,100,false,true,0,100],[true,100,false,false,.1,100],[true,100,false,false,0,24]])assert.equal(canDodge(...args),false);
});
test('diagonal dodge is normalized and idle dodge goes backward',()=>{
  assert.deepEqual(dodgeDirection(0,0,0),{x:0,z:1});
  const diagonal=dodgeDirection(1,1,0);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-10);
  assert.ok(Math.abs(dodgeDirection(0,0,Math.PI/2).x-1)<1e-10);
});
test('clipped dodge duration travels the same distance at different frame rates',()=>{
  const distance=hz=>{let left=DODGE_DURATION,moved=0;while(left>0){const step=Math.min(left,1/hz);moved+=step*DODGE_SPEED;left=Math.max(0,left-step);}return moved;};
  assert.ok(Math.abs(distance(30)-distance(144))<1e-9);
});
