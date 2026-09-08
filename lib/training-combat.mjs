import {inArc,inMountedReach,mountedDamage,defend,ATTACK_DURATION,HIT_TIME} from './combat.mjs';
import {WORLD_SOLIDS} from './world.mjs';

// Segment/AABB intersection at sword height, independent of rendering geometry.
export function clearStrike(x,z,tx,tz,solids=WORLD_SOLIDS) {
  return !solids.some(o=>{
    if(o.h<1.45)return false;
    let lo=0,hi=1;
    for(const [start,delta,min,max] of [[x,tx-x,o.x-o.w/2,o.x+o.w/2],[z,tz-z,o.z-o.d/2,o.z+o.d/2]]) {
      if(Math.abs(delta)<1e-9){if(start<min||start>max)return false;}
      else {const a=(min-start)/delta,b=(max-start)/delta;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false;}
    }
    return hi>=0&&lo<=1;
  });
}

// Returns only serializable state and events; callers own sound, camera and meshes.
export function stepTrainingCombat(state,targets,dt,solids=WORLD_SOLIDS) {
  const p={...state}, enemies=targets.map(t=>({...t})),events=[];
  const emit=(type,extra={})=>events.push({type,...extra});
  if(!Number.isFinite(dt)||dt<=0||dt>.04||!p.active||p.health<=0)return {player:p,targets:enemies,events};
  p.regenDelay=Math.max(0,p.regenDelay-dt);
  if(p.blocking){p.stamina=Math.max(0,p.stamina-dt*9);p.regenDelay=.55;if(p.stamina===0){p.blocking=false;emit('exhausted');}}
  else if(p.attackTime<0&&p.regenDelay===0)p.stamina=Math.min(100,p.stamina+dt*24);
  if(p.attackTime>=0){
    p.attackTime+=dt;
    if(!p.hitChecked&&p.attackTime>=(p.mounted?.18:HIT_TIME)&&p.attackTime<=(p.mounted?.4:ATTACK_DURATION)){
      if(!p.mounted)p.hitChecked=true;
      const candidate=enemies.filter(t=>t.hp>0&&(p.mounted?inMountedReach:inArc)(p.x,p.z,p.heading,t.x,t.z)&&clearStrike(p.x,p.z,t.x,t.z,solids))
        .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
      if(candidate){p.hitChecked=true;const damage=p.mounted?mountedDamage(p.speed>0?p.actualSpeed:0):34;candidate.hp=Math.max(0,candidate.hp-damage);candidate.flash=.3;p.hitCount++;emit('hit',{damage,killed:candidate.hp===0});if(candidate.hp===0){candidate.respawn=4;candidate.windup=0;}}
      else if(!p.mounted)emit('miss');
    }
    if(p.attackTime>=ATTACK_DURATION){if(p.mounted&&!p.hitChecked)emit('miss');p.attackTime=-1;}
  }
  for(const t of enemies){
    t.flash=Math.max(0,t.flash-dt);
    if(t.hp===0){t.respawn=Math.max(0,t.respawn-dt);if(t.respawn===0){t.hp=100;t.cooldown=1.5;}continue;}
    if(p.health<=0)break;
    if(Math.hypot(p.x-t.x,p.z-t.z)>=3||!clearStrike(p.x,p.z,t.x,t.z,solids)){t.windup=0;t.cooldown=1.3;continue;}
    if(t.windup>0){t.windup=Math.max(0,t.windup-dt);if(t.windup===0){
      const result=defend(p.stamina,p.blocking,inArc(p.x,p.z,p.heading,t.x,t.z,3,.25));
      p.stamina=result.stamina;p.health=Math.max(0,p.health-result.damage);p.regenDelay=.8;t.cooldown=2.2;
      if(result.blocked){p.blockCount++;emit('block');}else emit('hurt');
      if(p.health===0){p.blocking=false;p.attackTime=-1;emit('death');}
    }}else{t.cooldown-=dt;if(t.cooldown<=0){t.windup=.85;emit('warning');}}
  }
  return {player:p,targets:enemies,events};
}
