import test from 'node:test';
import assert from 'node:assert/strict';
import {stepPlayerMotion,parseMovementMessage} from './player-motion.mjs';
import {isFree,moveWithCollisions} from './world.mjs';
const initial=()=>({x:0,z:21,vx:0,vz:0,heading:0,speed:0,steering:0,active:true,health:100,mounted:false,blocking:false,attacking:false,dodgeLeft:0,dodgeX:0,dodgeZ:1});
const input={forward:1,side:0,yaw:0,sprint:false};
test('recorded inputs replay identically after JSON serialization',()=>{
  let a=initial(),b=JSON.parse(JSON.stringify(a));
  for(let n=0;n<180;n++){
    const command={...input,side:n>90?.5:0};
    a=stepPlayerMotion(a,command,1/60);b=stepPlayerMotion(b,JSON.parse(JSON.stringify(command)),1/60);
  }
  assert.deepEqual(a,b);assert.ok(a.z<20);assert.ok(isFree(a.x,a.z,.48));
});
test('paused and dead riders cannot move, including while mounted',()=>{
  for(const state of [{...initial(),active:false},{...initial(),health:0},{...initial(),mounted:true,health:0,speed:13}]){
    const next=stepPlayerMotion(state,input,.04);assert.equal(next.z,state.z);assert.equal(next.speed,0);
  }
});
test('diagonal input has no speed advantage and analog input retains its magnitude',()=>{
  let straight=initial(),diagonal=initial(),analog=initial();
  for(let n=0;n<30;n++){
    straight=stepPlayerMotion(straight,input,1/60,[]);
    diagonal=stepPlayerMotion(diagonal,{...input,side:1},1/60,[]);
    analog=stepPlayerMotion(analog,{...input,forward:.5},1/60,[]);
  }
  assert.ok(Math.abs(straight.speed-diagonal.speed)<1e-9);assert.ok(Math.abs(analog.speed-1.65)<1e-9);
});
test('sweeps stop at a thin wall while allowing movement along it',()=>{
  const walls=[{x:1,z:0,w:.1,d:10}];
  const moved=moveWithCollisions(0,0,4,2,.48,walls);
  assert.ok(moved.x<.48);assert.ok(moved.z>1.9);assert.equal(moved.blockedX,true);
});
test('sprint, horse and dodge remain within map bounds',()=>{
  for(const state of [{...initial(),z:-28},{...initial(),mounted:true,z:-28,speed:13},{...initial(),z:-28,dodgeLeft:.28,dodgeZ:-1}]){
    let current=state;for(let n=0;n<30;n++)current=stepPlayerMotion(current,{...input,sprint:true},1/60);
    assert.ok(isFree(current.x,current.z,current.mounted?1.2:.48));
  }
});
test('input boundary rejects state injection and malformed messages',()=>{
  const valid={type:'move',sequence:4,...input};assert.equal(parseMovementMessage(valid).sequence,4);
  for(const message of [null,{...valid,x:200},{...valid,health:1000},{...valid,dt:5},{...valid,sequence:-1},{...valid,yaw:NaN},{...valid,sprint:'true'}])
    assert.throws(()=>parseMovementMessage(message));
  assert.equal(parseMovementMessage({...valid,forward:100}).forward,1);
});
test('simulation cannot be accelerated using a large time step',()=>{
  assert.throws(()=>stepPlayerMotion(initial(),input,1));assert.throws(()=>stepPlayerMotion(initial(),input,NaN));
});
