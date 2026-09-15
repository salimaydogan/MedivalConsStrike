import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch } from './match.mjs';
import { meleeProfile, attackDirection } from './directional-combat.mjs';
import { meleePose } from './melee-pose.mjs';
import { parseCommand } from '../server/rooms.mjs';

function duel() {
  const m = createMatch();
  m.actors.forEach((a,i)=>Object.assign(a,{bot:false,protection:0,x:25,z:20+i}));
  const [a,,b]=m.actors;
  Object.assign(a,{x:0,z:0,heading:0,weapon:'sword'});
  Object.assign(b,{x:0,z:-2,heading:Math.PI,weapon:'sword'});
  return {m,a,b};
}
test('held melee cannot hit; swipe selects direction and release strikes once',()=>{
  const {m,a,b}=duel(); const hp=b.health;
  stepMatch(m,{[a.id]:{attack:true,attackHeld:true}});
  for(let i=0;i<90;i++) stepMatch(m,{[a.id]:{attackHeld:true,attackDirection:'left'}});
  assert.equal(b.health,hp); assert.equal(a.attackDirection,'left');
  for(let i=0;i<60;i++) stepMatch(m,{[a.id]:{attackHeld:false}});
  assert.equal(b.health,hp-Math.round(34*b.armor));
});
test('fresh guard parries and interrupts attacker; sustained guard only blocks',()=>{
  for(const fresh of [true,false]) {
    const {m,a,b}=duel();
    if(!fresh) for(let i=0;i<20;i++)stepMatch(m,{[b.id]:{guard:true,yaw:Math.PI}});
    Object.assign(a,{attackTime:0.23,hitChecked:false});
    const hp=b.health;
    stepMatch(m,{[b.id]:{guard:true,yaw:Math.PI}});
    assert.equal(b.health,hp);
    assert.ok(m.events.some(e=>e.type===(fresh?'parry':'block')));
    assert.equal(a.stagger>0,fresh);
  }
});
test('damage interrupts windup and stagger prevents a new attack',()=>{
  const {m,a,b}=duel();
  Object.assign(a,{attackTime:0.23,hitChecked:false});
  Object.assign(b,{attackTime:0.01,hitChecked:false});
  stepMatch(m);
  assert.equal(b.attackTime,-1); assert.ok(b.stagger>0);
  stepMatch(m,{[b.id]:{attack:true}}); assert.equal(b.attackTime,-1);
});
test('guard tapping cannot refresh the parry window immediately',()=>{
  const {m,b}=duel();
  stepMatch(m,{[b.id]:{guard:true}}); assert.equal(b.parryReady,true);
  stepMatch(m); stepMatch(m,{[b.id]:{guard:true}});
  assert.equal(b.parryReady,false);
});
test('direction changes pose and reach; invalid online direction is rejected',()=>{
  assert.equal(attackDirection(30,1),'right'); assert.equal(attackDirection(0,-30),'overhead');
  assert.equal(meleePose('sword',0.14,'left').y,-meleePose('sword',0.14,'right').y);
  assert.ok(meleeProfile('sword','thrust').range>meleeProfile('sword','left').range);
  const command = {type:'move',sequence:1,forward:0,side:0,yaw:0,sprint:false,attackHeld:true};
  assert.equal(parseCommand({...command,attackDirection:'left'}).attackDirection,'left');
  assert.throws(()=>parseCommand({...command,attackDirection:'infinite'}));
});
