import {horseMotion,turnToward} from './movement.mjs';
import {DODGE_SPEED} from './dodge.mjs';
import {moveWithCollisions,WORLD_COLLIDERS} from './world.mjs';

const axis=value=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
export function normalizeMovementInput(input) {
  return {forward:axis(input.forward),side:axis(input.side),
    yaw:Number.isFinite(input.yaw)?Math.atan2(Math.sin(input.yaw),Math.cos(input.yaw)):0,sprint:input.sprint===true};
}

// Future wire boundary: accepts intent only, never position, health, speed or client dt.
// Session identity, sequence ordering and rate limits still belong to the future room server.
export function parseMovementMessage(message) {
  if(!message||typeof message!=='object'||Array.isArray(message))throw new Error('Invalid movement message');
  const allowed=['type','sequence','forward','side','yaw','sprint'];
  if(Object.keys(message).some(key=>!allowed.includes(key))||message.type!=='move'||
    !Number.isSafeInteger(message.sequence)||message.sequence<0||
    ![message.forward,message.side,message.yaw].every(Number.isFinite)||typeof message.sprint!=='boolean')
    throw new Error('Invalid movement message');
  return {sequence:message.sequence,...normalizeMovementInput(message)};
}

// Pure simulation step; state and dt are owned by the caller (the server in online play).
// No DOM, Three.js, wall clock, random state or renderer references.
export function stepPlayerMotion(state,rawInput,dt,colliders=WORLD_COLLIDERS) {
  if(!Number.isFinite(dt)||dt<=0||dt>.04)throw new Error('Simulation step must be in (0, .04] seconds');
  const next={...state};
  if(!state.active||state.health<=0)return {...next,speed:0,vx:0,vz:0,steering:0,dodgeLeft:0,moved:0,actualSpeed:0};
  const {forward,side,yaw,sprint:requestedSprint}=normalizeMovementInput(rawInput);
  const sprint=requestedSprint&&!state.blocking&&(state.mounted||!state.attacking);
  let dx=0,dz=0;
  if(state.mounted){
    const motion=horseMotion(state.speed,state.steering,forward,side,sprint,dt);
    next.speed=motion.speed;next.steering=motion.steering;next.heading+=motion.turn;
    dx=-Math.sin(next.heading)*next.speed*dt;dz=-Math.cos(next.heading)*next.speed*dt;
  }else{
    const length=Math.hypot(forward,side),maxSpeed=state.blocking?1.65:state.attacking?2:sprint?6:3.3;
    const tx=(side*Math.cos(yaw)-forward*Math.sin(yaw))/Math.max(1,length)*maxSpeed;
    const tz=(-forward*Math.cos(yaw)-side*Math.sin(yaw))/Math.max(1,length)*maxSpeed;
    const ax=tx-state.vx,az=tz-state.vz,delta=Math.hypot(ax,az),limit=(length?26:34)*dt;
    const amount=delta>limit?limit/delta:1;
    next.vx+=ax*amount;next.vz+=az*amount;next.speed=Math.hypot(next.vx,next.vz);
    dx=next.vx*dt;dz=next.vz*dt;
    if(state.blocking||state.attacking)next.heading=turnToward(state.heading,yaw,18,dt);
    else if(next.speed>.08)next.heading=turnToward(state.heading,Math.atan2(-next.vx,-next.vz),14,dt);
  }
  if(state.dodgeLeft>0){
    const slice=Math.min(dt,state.dodgeLeft);
    dx=state.dodgeX*DODGE_SPEED*slice;dz=state.dodgeZ*DODGE_SPEED*slice;
    next.dodgeLeft=Math.max(0,state.dodgeLeft-slice);next.vx=next.vz=0;
  }
  const result=moveWithCollisions(state.x,state.z,dx,dz,state.mounted?1.2:.48,colliders);
  next.x=result.x;next.z=result.z;
  if(!state.mounted){if(result.blockedX)next.vx=0;if(result.blockedZ)next.vz=0;}
  const moved=Math.hypot(next.x-state.x,next.z-state.z);
  if(state.mounted&&moved<Math.hypot(dx,dz)*.3)next.speed=0;
  return {...next,moved,actualSpeed:moved/dt};
}
