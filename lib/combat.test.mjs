import test from 'node:test';
import assert from 'node:assert/strict';
import { canAttack, inArc, defend } from './combat.mjs';
test('swing requires stamina, free hands, and dismounted rider',()=>{
  assert.equal(canAttack(24,false,false,false),true);
  for(const args of [[23,false,false,false],[100,true,false,false],[100,false,true,false],[100,false,false,true]])assert.equal(canAttack(...args),false);
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
