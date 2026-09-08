export const DODGE_COST=25;
export const DODGE_DURATION=.28;
export const DODGE_SPEED=9;
export function canDodge(active,health,mounted,attacking,cooldown,stamina) {
  return active && health>0 && !mounted && !attacking && cooldown<=0 && stamina>=DODGE_COST;
}
export function dodgeDirection(side,forward,yaw) {
  // No directional input means a backward step relative to the camera.
  if(Math.hypot(side,forward)<.15){side=0;forward=-1;}
  const length=Math.hypot(side,forward);
  return {x:(side*Math.cos(yaw)-forward*Math.sin(yaw))/length,
    z:(-forward*Math.cos(yaw)-side*Math.sin(yaw))/length};
}
