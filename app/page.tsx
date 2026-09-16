'use client';

import { useEffect, useRef, useState } from 'react';
import MobileControls from '../components/mobile-controls';
import {canDodge,dodgeDirection,DODGE_COST,DODGE_DURATION} from '../lib/dodge.mjs';
import * as THREE from 'three';
import { turnToward } from '../lib/movement.mjs';
import {stepPlayerMotion} from '../lib/player-motion.mjs';
import {WORLD_SOLIDS,TARGET_POSITIONS,isFree} from '../lib/world.mjs';

import { canAttack, swordAngle, attackCost, ATTACK_DURATION } from '../lib/combat.mjs';

import {stepTrainingCombat} from '../lib/training-combat.mjs';

type Status = { mounted: boolean; near: boolean; speed: number; distance: number };
export default function Home() {
  const host = useRef<HTMLDivElement>(null);
  const commands = useRef({ reset: () => {}, mount: () => {}, play: () => {},pause:()=>{},move:(_x:number,_y:number)=>{},look:(_x:number,_y:number)=>{},attack:()=>{},dodge:()=>{},jump:()=>{},guard:(_held:boolean)=>{},sprint:(_held:boolean)=>{},controlMode:(_touch:boolean)=>{} });
  const [touch,setTouch]=useState(false);

  const [combatUI,setCombatUI]=useState({stamina:100,health:100,hits:0,blocks:0,message:'Hedeflere yaklaş · Sol tıkla saldır',blocking:false,hurt:0,dead:false});
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>({ mounted: false, near: true, speed: 0, distance: 0 });
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'reset_training', description: 'Reset the rider and horse to their starting positions and clear training distance.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: unknown) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
          commands.current.reset();
          return { reset: true, mounted: false, distance: 0 };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Optional browser capability. */ }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError('3B görüntü başlatılamadı. Donanım hızlandırması açık bir masaüstü tarayıcıda tekrar dene.'); return; }
    const root = host.current;
    let mobile=matchMedia('(pointer: coarse)').matches;setTouch(mobile);renderer.setPixelRatio(Math.min(devicePixelRatio, mobile?1.25:1.7)); renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; renderer.setClearColor(0xa6bfca);
    root.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xa6bfca, 58, 145);
    const camera = new THREE.PerspectiveCamera(55, 1, .1, 200);
    scene.add(new THREE.HemisphereLight(0xe2f0ff, 0x555637, 2.5));
    const sun = new THREE.DirectionalLight(0xffe4b9, 3); sun.position.set(-20, 35, 18); sun.castShadow = true;
    sun.shadow.normalBias=.05;sun.shadow.bias=-.00015;
    sun.shadow.mapSize.set(mobile?1024:2048, mobile?1024:2048); Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, far: 100 }); scene.add(sun);
    const mats = new Map<number, THREE.MeshStandardMaterial>();
    const mat = (c: number) => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true })); return mats.get(c)!; };
    const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, c: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    const solidMeshes=WORLD_SOLIDS.map(o=>box(scene,o.w,o.h,o.d,o.x,o.h/2,o.z,o.color));
    box(scene, 240, .3, 240, 0, -.2, 0, 0x6f8060);
    box(scene, 62, .12, 62, 0, -.02, 0, 0xaca381);
    box(scene, 8, .03, 57, 0, .06, 0, 0xc4b99a);
    box(scene, 56, .03, 7, 0, .07, 0, 0xbab092);
    for (let n = -30; n <= 30; n += 3) for (const s of [-1,1]) {
      box(scene,1.5,1.2,2,n,7.6,s*32,0x858b80); box(scene,2,1.2,1.5,s*32,7.6,n,0x858b80);
    }
    for (const x of [-30,30]) for (const z of [-30,30]) {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5,5,4), mat(z > 0 ? 0x284e65 : 0x8f4237)); roof.position.set(x,13.5,z); roof.rotation.y = Math.PI/4; scene.add(roof);
    }
    for (const z of [-29,29]) {
      box(scene,.16,8,.16,-5,4,z,0x594b36);
      box(scene,2.6,3,.12,-3.7,6,z,z>0?0x327795:0xad4f40);
      box(scene,8,.05,4,0,.1,z,z>0?0x426e7b:0x985c4c);
    }
    for(let i=0;i<40;i++) {
      const a=i*2.4, r=49+(i%6)*7, x=Math.sin(a)*r,z=Math.cos(a)*r;
      box(scene,.6,3,.6,x,1.5,z,0x67553d);
      const tree=new THREE.Mesh(new THREE.ConeGeometry(2.4,7,5),mat(i%2?0x405e50:0x516c51)); tree.position.set(x,5,z); scene.add(tree);
    }
    for(let i=0;i<12;i++) {
      const peak=new THREE.Mesh(new THREE.ConeGeometry(16+i%3*7,25+i%4*7,5),mat(0x7c9594)); const a=i/12*Math.PI*2; peak.position.set(Math.sin(a)*112,8,Math.cos(a)*112); scene.add(peak);
    }
    const player = new THREE.Group(); scene.add(player);
    const torso=box(player,.7,.85,.42,0,1.22,0,0x316f8b);
    box(player,.48,.46,.45,0,1.9,0,0xb9bfc0); box(player,.34,.1,.025,0,1.91,-.24,0x25343b);
    const limb = (parent: THREE.Object3D, x: number, y: number, z: number, length: number, width: number, color: number) => {
      const pivot = new THREE.Group(); pivot.position.set(x,y,z); parent.add(pivot);
      box(pivot,width,length,width,0,-length/2,0,color); return pivot;
    };
    const legs=[limb(player,-.2,.85,0,.38,.23,0x3e4442),limb(player,.2,.85,0,.38,.23,0x3e4442)];
    const knees=legs.map(leg=>{const knee=limb(leg,0,-.38,0,.34,.21,0x454b48);box(knee,.25,.14,.4,0,-.33,-.07,0x302f2c);return knee;});
    const arms=[limb(player,-.5,1.58,0,.65,.23,0x9aabb0),limb(player,.5,1.58,0,.65,.23,0x9aabb0)];
    box(arms[1],.12,.85,.12,0,-.85,-.2,0xc0c6c2); box(arms[1],.42,.09,.18,0,-.5,-.2,0xc3a264);
    const shield=box(arms[0],.12,.8,.65,-.14,-.4,-.06,0x315f73);
    const shieldFront=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
    const horse = new THREE.Group(); scene.add(horse);
    box(horse,.85,.95,1.65,0,1.42,0,0x77523c);
    const neck=box(horse,.52,1.15,.65,0,2,-.77,0x886044); neck.rotation.x=-.3;
    box(horse,.48,.48,.85,0,2.5,-1.05,0x886044);
    box(horse,.12,.28,.16,-.18,2.87,-.86,0x60432f); box(horse,.12,.28,.16,.18,2.87,-.86,0x60432f);
    box(horse,.5,.12,.22,0,2.53,-1.47,0x423a30);
    box(horse,1,.13,.9,0,1.95,.12,0x273e48); box(horse,.7,.2,.55,0,2.09,.1,0x654633);
    box(horse,.19,.85,.2,0,1.3,1,0x3d352e);
    const horseLegs: THREE.Group[]=[]; const horseKnees: THREE.Group[]=[];
    for(const x of [-.32,.32]) for(const z of [-.55,.58]) {
      const leg=limb(horse,x,1.1,z,.52,.2,0x573f30);horseLegs.push(leg);
      const knee=limb(leg,0,-.52,0,.48,.17,0x634934);horseKnees.push(knee);
      box(knee,.23,.17,.3,0,-.46,-.03,0x332e28);
    }
    let stamina=100,health=100,hitCount=0,blockCount=0,blocking=false,attackTime=-1,hitChecked=false,regenDelay=0;
    let message='Hedeflere yaklaş · Sol tıkla saldır',messageTime=0,knockout=0,hurt=0,dodgeLeft=0,dodgeCooldown=0;
    const dodgeVector=new THREE.Vector3();
    let sound: AudioContext | undefined;
    const tone=(frequency:number,duration:number,kind:OscillatorType='triangle',volume=.055)=>{
      if(!sound || sound.state!=='running')return;
      const osc=sound.createOscillator(),gain=sound.createGain();
      osc.type=kind;osc.frequency.setValueAtTime(frequency,sound.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(40,frequency*.45),sound.currentTime+duration);
      gain.gain.setValueAtTime(volume,sound.currentTime);gain.gain.exponentialRampToValueAtTime(.001,sound.currentTime+duration);
      osc.connect(gain);gain.connect(sound.destination);osc.start();osc.stop(sound.currentTime+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    };
    const announce=(text:string)=>{message=text;messageTime=1.8;};
    const dummies=TARGET_POSITIONS.map(([x,z])=>{
      const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
      box(group,1.6,.15,1.6,0,.1,0,0x65583f);box(group,.22,1.9,.22,0,1,0,0x715237);
      const body=box(group,.85,.9,.55,0,1.45,0,0xb19558);
      const material=new THREE.MeshStandardMaterial({color:0xb19558,roughness:1});body.material=material;
      box(group,.5,.48,.5,0,2.15,0,0xb7a16b);
      box(group,1.65,.18,.2,0,1.62,0,0x82633f);
      const baton=new THREE.Group();baton.position.set(-.75,1.65,0);group.add(baton);box(baton,.14,.95,.14,0,-.4,0,0x624a36);
      box(group,1.2,.12,.09,0,2.65,0,0x423d31);const bar=box(group,1.15,.08,.1,0,2.65,.02,0x8cc482);
      return {group,body,material,baton,bar,hp:100,flash:0,cooldown:1.5,windup:0,respawn:0};
    });
    let mounted=false,active=false,yaw=0,pitch=.38,heading=0,speed=0,travel=0,time=0,last=performance.now(),lastHud=0,frame=0;
    const position=new THREE.Vector3(0,0,21); horse.position.set(2,0,18);
    const velocity=new THREE.Vector3(); let steering=0, gait=0, gaitWeight=0, mouseIdle=0, cameraReady=false;
    const cameraTarget=new THREE.Vector3();
    const keys=new Set<string>(); let dragging=false;let touchX=0,touchY=0;
    const free=isFree;
    const mount=()=>{
      if(attackTime>=0||blocking||knockout>0||dodgeLeft>0)return;
      if(mounted) { for(const side of [-1,1]) { const x=position.x+Math.cos(heading)*side*2,z=position.z-Math.sin(heading)*side*2; if(free(x,z,.5)){mounted=false;position.set(x,0,z);speed=0;velocity.set(0,0,0);steering=0;gaitWeight=0;horse.position.y=0;horse.rotation.x=horse.rotation.z=0;break;} } }
      else if(position.distanceTo(horse.position)<3.5) { mounted=true;position.copy(horse.position);heading=horse.rotation.y;speed=0;velocity.set(0,0,0);steering=0;gaitWeight=0; }
    };
    const reset=()=>{dodgeLeft=0;dodgeCooldown=0;stamina=100;health=100;hitCount=0;blockCount=0;blocking=false;attackTime=-1;regenDelay=0;knockout=0;hurt=0;setCombatUI({stamina:100,health:100,hits:0,blocks:0,message:'Hedeflere yaklaş · Sol tıkla saldır',blocking:false,hurt:0,dead:false});message='Hedeflere yaklaş · Sol tıkla saldır';for(const d of dummies){d.hp=100;d.flash=0;d.windup=0;d.cooldown=1.5;d.respawn=0;d.group.visible=true;}mounted=false;position.set(0,0,21);horse.position.set(2,0,18);horse.rotation.y=0;heading=0;yaw=0;speed=0;travel=0;velocity.set(0,0,0);steering=0;gait=0;gaitWeight=0;cameraReady=false;horse.rotation.x=horse.rotation.z=0;keys.clear();touchX=touchY=0;};
    const lock=()=>{try{sound??=new AudioContext();void sound.resume().catch(()=>{});}catch{/* Audio is optional. */}active=true;setPlaying(true);if(!mobile){const p=renderer.domElement.requestPointerLock?.();p?.catch(()=>{});}};
    const dodge=()=>{
      if(!canDodge(active,health,mounted,attackTime>=0,dodgeCooldown,stamina)){if(active&&!mounted&&stamina<DODGE_COST)announce('Kaçınmak için 25 dayanıklılık gerekli');return;}
      const side=THREE.MathUtils.clamp(touchX+Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),-1,1);
      const forward=THREE.MathUtils.clamp(touchY+Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),-1,1);
      const direction=dodgeDirection(side,forward,yaw);dodgeVector.set(direction.x,0,direction.z);
      stamina-=DODGE_COST;regenDelay=1;dodgeLeft=DODGE_DURATION;dodgeCooldown=.85;blocking=false;velocity.set(0,0,0);
      tone(150,.12,'triangle',.04);announce('Kaçınma · −25 dayanıklılık');
    };
    const down=(e:KeyboardEvent)=>{if(!active)return;if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)dodge();if(e.code==='KeyE'&&!e.repeat)mount();if(e.code==='KeyR'&&!e.repeat)reset();if(e.code==='Escape')pause();};
    const up=(e:KeyboardEvent)=>keys.delete(e.code);
    const pause=()=>{dodgeLeft=0;touchX=touchY=0;blocking=false;attackTime=-1;keys.clear();active=false;dragging=false;speed=0;velocity.set(0,0,0);steering=0;setPlaying(false);};
    const move=(e:MouseEvent)=>{if(active&&(document.pointerLockElement===renderer.domElement||dragging)){mouseIdle=0;yaw-=e.movementX*.003;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.002,.12,1.05);}};
    const pointerDown=(e:MouseEvent)=>{
      if(!active||knockout>0||dodgeLeft>0)return;
      dragging=true;
      if(e.button===2){if(attackTime<0&&stamina>0)blocking=true;return;}
      if(e.button!==0)return;
      if(!canAttack(stamina,attackTime>=0,blocking,mounted)){if(stamina<attackCost(mounted))announce('Dayanıklılığın toparlansın');return;}
      stamina-=attackCost(mounted);regenDelay=.9;attackTime=0;hitChecked=false;if(!mounted)heading=yaw;tone(240,.15,'sawtooth',.018);
    };
    const pointerUp=(e:MouseEvent)=>{dragging=false;if(e.button===2)blocking=false;};
    commands.current={reset,mount,play:lock,pause,dodge,jump:()=>{},
      controlMode:enabled=>{pause();mobile=enabled;setTouch(enabled);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.7));sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.map?.dispose();sun.shadow.map=null;resize();},
      move:(x,y)=>{touchX=x;touchY=y;},
      look:(x,y)=>{if(!active)return;mouseIdle=0;yaw-=x*.005;pitch=THREE.MathUtils.clamp(pitch+y*.004,.12,1.05);},
      attack:()=>pointerDown({button:0} as MouseEvent),
      guard:held=>{if(held)pointerDown({button:2} as MouseEvent);else blocking=false;},
      sprint:held=>{if(held&&active)keys.add('ShiftLeft');else keys.delete('ShiftLeft');}
    };
    const contextMenu=(e:MouseEvent)=>e.preventDefault();renderer.domElement.addEventListener('contextmenu',contextMenu);
    const lockChange=()=>{if(!document.pointerLockElement)pause();};
    const visibility=()=>{if(document.hidden)pause();};
    const resize=()=>{renderer.setSize(root.clientWidth,root.clientHeight);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();};resize();
    const surfaceResize=new ResizeObserver(resize);surfaceResize.observe(root);
    window.addEventListener('resize',resize);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerlockchange',lockChange);window.addEventListener('mousemove',move);renderer.domElement.addEventListener('mousedown',pointerDown);window.addEventListener('mouseup',pointerUp);
    const ray=new THREE.Raycaster(); const wallMeshes=solidMeshes;
    function tick(now:number){
      frame=requestAnimationFrame(tick);const dt=Math.max(.001,Math.min((now-last)/1000,.04));last=now;time+=dt;
      const forward=active?THREE.MathUtils.clamp(touchY+Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),-1,1):0;
      const side=active?THREE.MathUtils.clamp(touchX+Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),-1,1):0;
      const previousSpeed=speed;
      const motion=stepPlayerMotion({x:position.x,z:position.z,vx:velocity.x,vz:velocity.z,heading,speed,steering,
        active,health,mounted,blocking,attacking:attackTime>=0,dodgeLeft,dodgeX:dodgeVector.x,dodgeZ:dodgeVector.z},
        {forward,side,yaw,sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')},dt);
      position.set(motion.x,0,motion.z);velocity.set(motion.vx,0,motion.vz);
      heading=motion.heading;speed=motion.speed;steering=motion.steering;dodgeLeft=motion.dodgeLeft;
      if(active)dodgeCooldown=Math.max(0,dodgeCooldown-dt);
      const {moved,actualSpeed}=motion;travel+=moved;
      const amount=Math.min(actualSpeed/(mounted?7:3.3),1);
      gaitWeight=THREE.MathUtils.damp(gaitWeight,amount,12,dt);
      const gallop=THREE.MathUtils.smoothstep(actualSpeed,7,12);
      gait+=moved*(mounted?THREE.MathUtils.lerp(2.8,1.9,gallop):3.7);
      const bounce=mounted?Math.sin(gait*2)*(.035+gallop*.065)*gaitWeight:Math.cos(gait*2)*.035*gaitWeight;
      if(mounted){horse.position.copy(position);horse.position.y=bounce;horse.rotation.y=heading;
        horse.rotation.z=THREE.MathUtils.damp(horse.rotation.z,steering*Math.min(actualSpeed/13,1)*.13,7,dt);
        horse.rotation.x=THREE.MathUtils.damp(horse.rotation.x,Math.sin(gait)*gallop*.045*gaitWeight+THREE.MathUtils.clamp((speed-previousSpeed)/dt*.005,-.05,.05),8,dt);
      }
      player.position.copy(position);player.position.y=mounted?1.25+bounce:Math.max(0,bounce);
      player.rotation.y=heading;player.rotation.x=THREE.MathUtils.damp(player.rotation.x,mounted?-.08*gaitWeight:actualSpeed*.012,10,dt);
      player.rotation.z=mounted?horse.rotation.z*.65:Math.sin(gait)*.025*gaitWeight;
      for(let i=0;i<2;i++){
        const stride=Math.sin(gait+i*Math.PI);
        legs[i].rotation.x=mounted?-.95:stride*.65*gaitWeight;
        legs[i].rotation.z=mounted?(i===0?-.28:.28):0;
        knees[i].rotation.x=mounted?1.1:Math.max(0,-stride)*.85*gaitWeight;
        arms[i].rotation.x=mounted?-.65:-stride*.5*gaitWeight;
      }
      if(active&&health>0)messageTime=Math.max(0,messageTime-dt);
      const combat=stepTrainingCombat({active,health,stamina,blocking,attackTime,hitChecked,regenDelay,hitCount,blockCount,mounted,x:position.x,z:position.z,heading,speed,actualSpeed},dummies.map(d=>({x:d.group.position.x,z:d.group.position.z,hp:d.hp,flash:d.flash,cooldown:d.cooldown,windup:d.windup,respawn:d.respawn})),dt);
      ({health,stamina,blocking,attackTime,hitChecked,regenDelay,hitCount,blockCount}=combat.player);
      combat.targets.forEach((t: {hp:number;flash:number;cooldown:number;windup:number;respawn:number},i:number)=>Object.assign(dummies[i],t));
      for(const event of combat.events){
        switch(event.type){
          case 'exhausted':announce('Kalkan düştü · Dinlen');break;
          case 'hit':tone(115,.12,'triangle',.13);announce(event.killed?'Hedef devrildi · 4 saniyede yenilenir':(mounted?'Atlı isabet · −':'İsabet · −')+event.damage);break;
          case 'miss':announce(mounted?'Iska · Hedefi sağında tut':'Iska · Hedefe yaklaş ve kamerayı çevir');break;
          case 'block':tone(720,.16,'square',.035);announce('Blok! · −18 dayanıklılık');break;
          case 'hurt':hurt=.75;tone(85,.3,'sawtooth',.12);announce('DARBE ALDIN · −15 CAN');break;
          case 'warning':announce(mobile?'Hedef vuracak · Ona dön ve Kalkanı tut':'Hedef vuracak · Ona dön ve sağ tıkı tut');break;
          case 'death':knockout=.001;speed=0;velocity.set(0,0,0);keys.clear();announce('Öldün');document.exitPointerLock();break;
        }
      }
      hurt=Math.max(0,hurt-dt);
      if(health===0)knockout+=dt;
      for(const d of dummies){
        d.bar.scale.x=Math.max(.001,d.hp/100);d.bar.position.x=-(1-d.hp/100)*.575;
        d.group.rotation.z=d.hp===0?1.15:Math.sin(d.flash*35)*d.flash*.5;
        d.material.emissive.setHex(d.windup>0?0xc44b12:d.flash>0?0x887233:0x000000);
        d.baton.rotation.x=d.windup>0?-2*(1-d.windup/.85):0;
      }
      arms[0].rotation.z=0;arms[1].rotation.z=0;
      if(blocking){arms[0].rotation.x=1.4;arms[0].rotation.z=-.5;arms[1].rotation.x=.7;}
      if(attackTime>=0){const phase=attackTime/ATTACK_DURATION;
        arms[1].rotation.x=mounted?.35+Math.sin(phase*Math.PI)*.65:swordAngle(attackTime);
        arms[1].rotation.z=mounted?Math.sin(phase*Math.PI)*1.15:-Math.sin(phase*Math.PI)*.3;
        torso.rotation.y=Math.sin(phase*Math.PI*2)*.2;
      }else torso.rotation.y=0;
      const trotPhases=[0,Math.PI,Math.PI,0],gallopPhases=[0,1.5,.45,1.95];
      for(let i=0;i<4;i++){
        const phase=gait+THREE.MathUtils.lerp(trotPhases[i],gallopPhases[i],gallop);
        const weight=mounted?gaitWeight:0;
        horseLegs[i].rotation.x=Math.sin(phase)*(.55+gallop*.25)*weight;
        horseKnees[i].rotation.x=Math.max(0,-Math.sin(phase))*.9*weight;
      }
      if(dodgeLeft>0&&health>0){player.position.y-=.12;player.rotation.x=.3;arms[0].rotation.x=.6;arms[1].rotation.x=.5;}
      if(health===0){
        const fall=THREE.MathUtils.smoothstep(knockout,0,.65);
        player.rotation.x=-Math.PI/2*fall;player.rotation.z=.16*fall;player.position.y=.25*fall;
        arms[0].rotation.x=.3;arms[1].rotation.x=.2;
      }else if(hurt>0){player.rotation.x-=Math.sin((.75-hurt)*20)*hurt*.2;}
      // The shield is thin along X. Rotate that normal toward forward (-Z),
      // cancelling the raised arm rotation so the face covers the chest.
      if(blocking&&health>0){
        const inverseArm=arms[0].quaternion.clone().invert();
        shield.quaternion.copy(inverseArm).multiply(shieldFront);
        shield.position.set(-.25,1.3,-.72).sub(arms[0].position).applyQuaternion(inverseArm);
      }else{shield.rotation.set(0,0,0);shield.position.set(-.14,-.4,-.06);}
      neck.rotation.x=-.3+(mounted?Math.sin(gait*2)*.035*gaitWeight:0);
      torso.position.y=1.22;
      mouseIdle+=dt;
      if(mounted&&active&&actualSpeed>.5&&mouseIdle>1.3)yaw=turnToward(yaw,heading,2,dt);
      const target=position.clone().add(new THREE.Vector3(0,mounted?2.6:1.5,0));
      if(!cameraReady){cameraTarget.copy(target);cameraReady=true;}else cameraTarget.lerp(target,1-Math.exp(-12*dt));
      const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
      const wantedDistance=(mounted?7.5:5.8)+Math.min(actualSpeed/13,1)*1.2;
      // Cast along the final smoothed camera ray so follow lag cannot pull the camera through walls.
      const desired=cameraTarget.clone().addScaledVector(offset,wantedDistance);
      const direction=desired.clone().sub(target);const wanted=direction.length();direction.normalize();
      ray.set(target,direction);const hits=ray.intersectObjects(wallMeshes);
      const distance=Math.min(wanted,hits.length?Math.max(.4,hits[0].distance-.35):wanted);
      camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(cameraTarget);
      camera.fov=THREE.MathUtils.damp(camera.fov,55+Math.min(actualSpeed/13,1)*7,4,dt);camera.updateProjectionMatrix();
      renderer.render(scene,camera);
      if(now-lastHud>120){lastHud=now;setStatus({mounted,near:position.distanceTo(horse.position)<3.5,speed:Math.round(actualSpeed*3.6),distance:Math.round(travel)});setCombatUI({stamina:Math.round(stamina),health,hits:hitCount,blocks:blockCount,message:messageTime>0?message:mounted?(mobile?'Hedef sağında · Kılıç ile savur · Hızlan ile hücum':'Hedef sağında · Sol tık: savur · Shift: hücum'):blocking?'Kalkan hazır · Önden gelen darbeleri karşıla':mobile?'Kılıç: saldır · Kalkan: blok · Kaçın: hamle':'Sol tık: saldır · Sağ tık: blok',blocking,hurt,dead:health===0});}
    }frame=requestAnimationFrame(tick);
    return()=>{surfaceResize.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',pointerUp);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerlockchange',lockChange);renderer.domElement.removeEventListener('mousedown',pointerDown);renderer.domElement.removeEventListener('contextmenu',contextMenu);void sound?.close().catch(()=>{});dummies.forEach(d=>d.material.dispose());if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});mats.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
  }, []);
  return <main className={`game-shell ${touch?'touch-game':''}`}>
    <div ref={host} className="viewport" aria-label="Üç boyutlu kale antrenman alanı" />
    <header className="topbar"><div className="brand"><span className="sigil">♜</span><div><strong>MedivalConsStrike</strong><small>MOBİL TALİM · 0.6</small></div></div><span className="map-label">KUZEY AVLUSU <i /> SERBEST ANTRENMAN</span><a href="/roadmap.html" style={{color:"#e6bd7c",fontSize:14}}>Yol haritası ↗</a><button onClick={()=>{commands.current.reset();}}>↺ Baştan başla</button></header>
    <aside className="objective"><span className="eyebrow">KILIÇ VE KALKAN</span><h2>Hücumu dene.</h2><p>Atla hedefin solundan geç.<br/>Hedef sağındayken kılıç savur.<br/>Shift ile hızlan; sağ tıkla blokla.</p><p>{combatUI.hits} isabet · {combatUI.blocks} blok</p><div className="progress"><span style={{width:`${Math.min(status.distance/100,1)*100}%`}} /></div><small>{Math.min(status.distance,100)} / 100 m keşfedildi</small></aside>
    <div className="crosshair" aria-hidden="true">·</div>
    {!playing && !combatUI.dead && <section className="start-panel"><span className="eyebrow">SINIRDA BİR SABAH</span><h1>Kılıcını kuşan.<br/><em>Talime başla.</em></h1><p>{touch?'Yaya veya atlı talim yap. Kılıç düğmesiyle saldır; kalkanı basılı tutarak blokla. At üstünde hedefi sağında tut.':'Yaya veya atlı talim yap. Sol tıkla saldır, sağ tıkla blokla. At üstünde hedefi sağında tut.'}</p><label className="control-mode">Kontroller<select value={touch?'touch':'keyboard'} onChange={e=>commands.current.controlMode(e.target.value==='touch')}><option value="touch">Dokunmatik</option><option value="keyboard">Klavye ve fare</option></select></label>{error?<p role="alert">{error}</p>:<button className="primary" onClick={()=>commands.current.play()}>Avluya gir <span>→</span></button>}<a className="battle-entry" href="/battle">⚔ Botlarla takım maçı →</a><small>{touch?'Sol çubuk: hareket · Sağ alanı sürükle: kamera. Düğmelerle saldır, blokla ve kaçın. Yatay ekran önerilir.':'WASD: hareket · Fare: kamera · Sol tık: saldır · Sağ tık: blok · Boşluk: kaçın'}</small></section>}
    {playing&&!touch&&(status.mounted||status.near)&&<button className="interact" onClick={()=>commands.current.mount()}><kbd>E</kbd> {status.mounted?'Attan in':'Ata bin'}</button>}
    <div className="damage-flash" aria-hidden="true" style={{opacity:combatUI.hurt/.75}} />
    {combatUI.hurt>0&&!combatUI.dead&&<div className="damage-number" role="status">−15 CAN</div>}
    {combatUI.dead&&<section className="death-panel" role="dialog" aria-modal="true" aria-labelledby="death-title"><span className="eyebrow">TALİM SONA ERDİ</span><h1 id="death-title">Öldün</h1><p>Bir sonraki denemede hedefe dönüp kalkanını kaldır.</p><button className="primary" onClick={()=>{commands.current.reset();commands.current.play();}}>Yeniden doğ →</button></section>}
    {playing&&<section className="combat-hud" aria-label="Savaş durumu"><p className={combatUI.blocking?'guarding':''}>{combatUI.message}</p><div><span>CAN {combatUI.health}</span><meter min="0" max="100" value={combatUI.health}/></div><div><span>DAYANIKLILIK {combatUI.stamina}</span><meter min="0" max="100" value={combatUI.stamina}/></div></section>}
    {touch&&playing&&!combatUI.dead&&<MobileControls input={commands.current} mounted={status.mounted} near={status.near}/>}
    <footer className="hud"><div className="rider"><div className="avatar">{status.mounted?'♞':'♜'}</div><div><small>MAVİ TAKIM · KEŞİF</small><strong>{status.mounted?'Atlı':'Yaya'} <span> {status.speed} km/sa</span></strong></div></div><div className="controls"><span><kbd>W A S D</kbd> Hareket</span><span><kbd>SOL TIK</kbd> Saldır</span><span><kbd>SAĞ TIK</kbd> Blok</span><span><kbd>BOŞLUK</kbd> Kaçın</span><span><kbd>SHIFT</kbd> Hızlan</span><span><kbd>E</kbd> Bin / in</span><span><kbd>ESC</kbd> Duraklat</span></div><span className="prototype">TEK OYUNCULU<br/><b>Kılıç–kalkan talimi</b></span></footer>
  </main>;
}

