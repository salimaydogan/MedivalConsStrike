import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, stepMatch} from './match.mjs';
import {parseCommand} from '../server/rooms.mjs';
function shot(ticks) {
  const m=createMatch();
  m.actors.forEach((a,i)=>Object.assign(a,{bot:false,x:24,z:20+i}));
  const a=m.actors[0];
  Object.assign(a,{x:0,z:0,weapon:'bow',heading:0});
  for(let i=0;i<ticks;i++) stepMatch(m,{[a.id]:{attack:i===0,attackHeld:true,yaw:0.5}});
  assert.equal(m.projectiles.length,0,'holding never fires automatically');
  stepMatch(m,{[a.id]:{attackHeld:false,yaw:0.5}});
  assert.equal(m.projectiles.length,1);
  const arrow={...m.projectiles[0]};
  for(let i=0;i<10;i++)stepMatch(m,{[a.id]:{attackHeld:false}});
  assert.equal(m.nextProjectile,1,'release fires once');
  return arrow;
}
test('bow holds until release; early shots have lower speed and damage',()=>{
  const early=shot(5),full=shot(60);
  assert.ok(early.damage<full.damage);
  assert.ok(Math.hypot(early.vx,early.vz)<Math.hypot(full.vx,full.vz));
  assert.equal(full.damage,30);
  assert.ok(Math.abs(Math.atan2(-full.vx,-full.vz)-0.5)<0.001);
});
test('wire accepts held intent but rejects client charge or invalid held values',()=>{
  const command={type:'move',sequence:1,forward:0,side:0,yaw:0,sprint:false,attackHeld:true};
  assert.equal(parseCommand(command).attackHeld,true);
  assert.throws(()=>parseCommand({...command,attackHeld:1}));
  assert.throws(()=>parseCommand({...command,bowCharge:1}));
});
