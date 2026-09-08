// Shared map geometry: visuals and simulation consume the same solid bounds.
const solids=[];
const add=(w,h,d,x,z,color=0x777e78)=>solids.push(Object.freeze({w,h,d,x,z,color}));
for(const x of [-32,32])add(2,7,66,x,0);
for(const z of [-32,32]){add(25,7,2,-20,z);add(25,7,2,20,z);add(14,3,2,0,z);}
for(const x of [-30,30])for(const z of [-30,30])add(6,11,6,x,z,0x838a81);
for(const x of [-18,18])for(const z of [-13,13]){
  add(8,2.7,2,x,z);add(2,2.7,5,x+(x>0?3:-3),z+2);add(2,1.5,2,x-3,z+5,0x806345);
}
export const WORLD_SOLIDS=Object.freeze(solids);
export const TARGET_POSITIONS=Object.freeze([[-5,11],[0,7],[5,11]].map(position=>Object.freeze(position)));
export const WORLD_COLLIDERS=Object.freeze([...WORLD_SOLIDS,...TARGET_POSITIONS.map(([x,z])=>Object.freeze({x,z,w:.95,d:.7}))]);

export function isFree(x,z,radius,colliders=WORLD_COLLIDERS) {
  return Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(radius)&&radius>0&&
    Math.abs(x)<30-radius&&Math.abs(z)<30-radius&&
    !colliders.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
}

export function moveWithCollisions(x,z,dx,dz,radius,colliders=WORLD_COLLIDERS) {
  // Small sweeps prevent thin obstacles being skipped during a fast dodge or ride.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.15));
  let blockedX=false,blockedZ=false;
  for(let i=0;i<steps;i++){
    if(isFree(x+dx/steps,z,radius,colliders))x+=dx/steps;else blockedX=true;
    if(isFree(x,z+dz/steps,radius,colliders))z+=dz/steps;else blockedZ=true;
  }
  return {x,z,blockedX,blockedZ};
}
