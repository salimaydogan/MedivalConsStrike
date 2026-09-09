import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, stepMatch, mountedImpactBonus} from './match.mjs';

function duel() {
  const m = createMatch();
  m.actors.forEach((a, i) => Object.assign(a, {bot:false, protection:0, x:25, z:20+i}));
  const [a,,b] = m.actors;
  Object.assign(a, {x:0,z:0,heading:0,weapon:'sword'});
  Object.assign(b, {x:0,z:-2,heading:Math.PI,weapon:'spear'});
  return {m,a,b};
}
test('mounted strike reaches either flank and locks aim during windup', () => {
  for (const side of [-1,1]) {
    const {m,a,b} = duel();
    Object.assign(a,{mounted:true});
    Object.assign(b,{x:side*2,z:0});
    stepMatch(m,{[a.id]:{attack:true,yaw:-side*Math.PI/2}});
    const health = b.health;
    for(let i=0;i<24;i++) stepMatch(m,{[a.id]:{yaw:side*Math.PI/2}});
    assert.ok(b.health < health);
    assert.equal(a.heading,0);
  }
});
test('spear guard parries a frontal melee strike but cannot stop arrows', () => {
  const {m,a,b} = duel();
  const health=b.health;
  stepMatch(m,{[a.id]:{attack:true},[b.id]:{guard:true,yaw:Math.PI}});
  for(let i=0;i<24;i++) stepMatch(m,{[b.id]:{guard:true,yaw:Math.PI}});
  assert.equal(b.health,health);
  m.projectiles.push({id:100,owner:a.id,team:a.team,x:0,z:-1.3,vx:0,vz:-24,left:1});
  stepMatch(m,{[b.id]:{guard:true,yaw:Math.PI}});
  assert.ok(b.health<health);
});
test('riding bonus uses closing velocity, not requested speed or retreat', () => {
  const a={x:0,z:0,contactVx:0,contactVz:-10,speed:13};
  const b={x:0,z:-2,contactVx:0,contactVz:0};
  assert.equal(mountedImpactBonus(a,b),14);
  assert.equal(mountedImpactBonus({...a,contactVz:0},b),0);
  assert.equal(mountedImpactBonus({...a,contactVz:10},b),0);
  assert.equal(mountedImpactBonus(a,{...b,contactVz:-10}),0);
});
