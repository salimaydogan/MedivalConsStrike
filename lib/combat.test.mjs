import test from 'node:test';
import assert from 'node:assert/strict';
import { canAttack, inArc, defend, swordAngle, HIT_TIME, ATTACK_DURATION, inMountedReach, mountedDamage } from './combat.mjs';
test('sword swings forward at contact and returns to rest',()=>{
  assert.ok(Math.sin(swordAngle(HIT_TIME))> .9);
  assert.ok(swordAngle(HIT_TIME-.01)>swordAngle(HIT_TIME+.01));
  assert.equal(swordAngle(ATTACK_DURATION),0);
});
test('swing requires stamina and free hands; mounted attacks cost more',()=>{
  assert.equal(canAttack(24,false,false,false),true);
  for(const args of [[23,false,false,false],[100,true,false,false],[100,false,true,false],[31,false,false,true]])assert.equal(canAttack(...args),false);
  assert.equal(canAttack(32,false,false,true),true);
});
test('mounted slash reaches only the right flank within weapon range',()=>{
  assert.equal(inMountedReach(0,0,0,2,-1),true);
  assert.equal(inMountedReach(0,0,0,-2,-1),false);
  assert.equal(inMountedReach(0,0,0,2,2),false);
  assert.equal(inMountedReach(0,0,0,4,0),false);
  assert.equal(inMountedReach(0,0,Math.PI/2,-1,-2),true);
});
test('charge bonus is capped and reverse grants no bonus',()=>{
  assert.equal(mountedDamage(-2),34);
  assert.equal(mountedDamage(0),34);
  assert.ok(mountedDamage(7)>34);
  assert.equal(mountedDamage(13),60);
  assert.equal(mountedDamage(100),60);
});
test('melee rejects distant, sideways and rear targets',()=>{
  assert.equal(inArc(0,0,0,0,-2),true);
  assert.equal(inArc(0,0,0,0,-3),false);
  assert.equal(inArc(0,0,0,0,2),false);
  assert.equal(inArc(0,0,0,2,0),false);
  assert.equal(inArc(0,0,Math.PI/2,-2,0),true);
});
test('shield only absorbs front hits with sufficient stamina',()=>{
  assert.deepEqual(defend(18,true,true),{blocked:true,stamina:0,damage:0});
  assert.equal(defend(17,true,true).damage,15);
  assert.equal(defend(100,true,false).damage,15);
  assert.equal(defend(100,false,true).damage,15);
});
