'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Status = { mounted: boolean; near: boolean; speed: number; distance: number };
export default function Home() {
  const host = useRef<HTMLDivElement>(null);
  const commands = useRef({ reset: () => {}, mount: () => {}, play: () => {} });
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
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0xa6bfca);
    root.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xa6bfca, 58, 145);
    const camera = new THREE.PerspectiveCamera(55, 1, .1, 200);
    scene.add(new THREE.HemisphereLight(0xe2f0ff, 0x555637, 2.5));
    const sun = new THREE.DirectionalLight(0xffe4b9, 3); sun.position.set(-20, 35, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, far: 100 }); scene.add(sun);
    const mats = new Map<number, THREE.MeshStandardMaterial>();
    const mat = (c: number) => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: .92, flatShading: true })); return mats.get(c)!; };
    const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, c: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    const obstacles: { x: number; z: number; w: number; d: number }[] = [];
    const solid = (w: number,h: number,d: number,x: number,z: number,c = 0x777e78) => { box(scene,w,h,d,x,h/2,z,c); obstacles.push({x,z,w,d}); };
    box(scene, 240, .3, 240, 0, -.2, 0, 0x6f8060);
    box(scene, 62, .12, 62, 0, -.02, 0, 0xaca381);
    box(scene, 8, .03, 57, 0, .06, 0, 0xc4b99a);
    box(scene, 56, .03, 7, 0, .07, 0, 0xbab092);
    for (const x of [-32, 32]) solid(2, 7, 66, x, 0);
    for (const z of [-32,32]) { solid(25,7,2,-20,z); solid(25,7,2,20,z); solid(14,3,2,0,z); }
    for (let n = -30; n <= 30; n += 3) for (const s of [-1,1]) {
      box(scene,1.5,1.2,2,n,7.6,s*32,0x858b80); box(scene,2,1.2,1.5,s*32,7.6,n,0x858b80);
    }
    for (const x of [-30,30]) for (const z of [-30,30]) {
      solid(6,11,6,x,z,0x838a81);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5,5,4), mat(z > 0 ? 0x284e65 : 0x8f4237)); roof.position.set(x,13.5,z); roof.rotation.y = Math.PI/4; scene.add(roof);
    }
    for (const z of [-29,29]) {
      box(scene,.16,8,.16,-5,4,z,0x594b36);
      box(scene,2.6,3,.12,-3.7,6,z,z>0?0x327795:0xad4f40);
      box(scene,8,.05,4,0,.1,z,z>0?0x426e7b:0x985c4c);
    }
    for (const x of [-18,18]) for (const z of [-13,13]) {
      solid(8,2.7,2,x,z); solid(2,2.7,5,x+(x>0?3:-3),z+2);
      solid(2,1.5,2,x-3,z+5,0x806345);
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
    const legs=[box(player,.23,.65,.27,-.2,.48,0,0x3e4442),box(player,.23,.65,.27,.2,.48,0,0x3e4442)];
    box(player,.23,.7,.25,-.5,1.2,0,0x9aabb0); box(player,.23,.7,.25,.5,1.2,0,0x9aabb0);
    box(player,.12,.85,.12,.55,.8,-.3,0xc0c6c2); box(player,.42,.09,.18,.55,1.15,-.3,0xc3a264);
    box(player,.12,.8,.65,-.64,1.1,-.06,0x315f73);
    const horse = new THREE.Group(); scene.add(horse);
    box(horse,.85,.95,1.65,0,1.42,0,0x77523c);
    const neck=box(horse,.52,1.15,.65,0,2,-.77,0x886044); neck.rotation.x=-.3;
    box(horse,.48,.48,.85,0,2.5,-1.05,0x886044);
    box(horse,.12,.28,.16,-.18,2.87,-.86,0x60432f); box(horse,.12,.28,.16,.18,2.87,-.86,0x60432f);
    box(horse,.5,.12,.22,0,2.53,-1.47,0x423a30);
    box(horse,1,.13,.9,0,1.95,.12,0x273e48); box(horse,.7,.2,.55,0,2.09,.1,0x654633);
    box(horse,.19,.85,.2,0,1.3,1,0x3d352e);
    const horseLegs: THREE.Mesh[]=[]; for(const x of [-.32,.32]) for(const z of [-.55,.58]) { horseLegs.push(box(horse,.2,1.1,.22,x,.55,z,0x573f30)); box(horse,.22,.18,.26,x,.09,z,0x332e28); }
    let mounted=false,active=false,yaw=0,pitch=.38,heading=0,speed=0,travel=0,time=0,last=performance.now(),lastHud=0,frame=0;
    const position=new THREE.Vector3(0,0,21); horse.position.set(2,0,18);
    const keys=new Set<string>(); let dragging=false;
    const free=(x:number,z:number,r:number)=>Math.abs(x)<30-r&&Math.abs(z)<30-r&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r);
    const mount=()=>{
      if(mounted) { for(const side of [-1,1]) { const x=position.x+Math.cos(heading)*side*2,z=position.z-Math.sin(heading)*side*2; if(free(x,z,.5)){mounted=false;position.set(x,0,z);speed=0;break;} } }
      else if(position.distanceTo(horse.position)<3.5) { mounted=true;position.copy(horse.position);heading=horse.rotation.y;speed=0; }
    };
    const reset=()=>{mounted=false;position.set(0,0,21);horse.position.set(2,0,18);horse.rotation.y=0;heading=0;yaw=0;speed=0;travel=0;keys.clear();};
    const lock=()=>{active=true;setPlaying(true);const p=renderer.domElement.requestPointerLock?.();p?.catch(()=>{});};
    commands.current={reset,mount,play:lock};
    const down=(e:KeyboardEvent)=>{if(!active)return;if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)mount();if(e.code==='KeyR'&&!e.repeat)reset();if(e.code==='Escape'){active=false;keys.clear();setPlaying(false);}};
    const up=(e:KeyboardEvent)=>keys.delete(e.code);
    const pause=()=>{keys.clear();active=false;dragging=false;setPlaying(false);};
    const move=(e:MouseEvent)=>{if(active&&(document.pointerLockElement===renderer.domElement||dragging)){yaw-=e.movementX*.003;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.002,.12,1.05);}};
    const pointerDown=()=>{dragging=true;}; const pointerUp=()=>{dragging=false;};
    const lockChange=()=>{if(!document.pointerLockElement)pause();};
    const visibility=()=>{if(document.hidden)pause();};
    const resize=()=>{renderer.setSize(root.clientWidth,root.clientHeight);camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();};resize();
    window.addEventListener('resize',resize);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerlockchange',lockChange);window.addEventListener('mousemove',move);renderer.domElement.addEventListener('mousedown',pointerDown);window.addEventListener('mouseup',pointerUp);
    const ray=new THREE.Raycaster(); const wallMeshes=scene.children.filter(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry && o.position.y>1 && Math.abs(o.position.x)>10);
    function tick(now:number){
      frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.04);last=now;time+=dt;
      const forward=active?Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')):0;
      const side=active?Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')):0;
      let dx=0,dz=0;
      if(mounted){const target=forward*(keys.has('ShiftLeft')?12:7);speed=THREE.MathUtils.damp(speed,target,2.5,dt);if(Math.abs(speed)>.2)heading-=side*dt*1.5*Math.sign(speed);dx=-Math.sin(heading)*speed*dt;dz=-Math.cos(heading)*speed*dt;}
      else{const length=Math.hypot(forward,side);speed=length?(keys.has('ShiftLeft')?6:3.5):0;if(length){dx=(side*Math.cos(yaw)-forward*Math.sin(yaw))/length*speed*dt;dz=(-forward*Math.cos(yaw)-side*Math.sin(yaw))/length*speed*dt;heading=Math.atan2(-dx,-dz);}}
      const radius=mounted?1.2:.48;const old=position.clone();if(free(position.x+dx,position.z,radius))position.x+=dx;if(free(position.x,position.z+dz,radius))position.z+=dz;travel+=old.distanceTo(position);
      if(mounted){horse.position.copy(position);horse.rotation.y=heading;}
      player.position.copy(position);player.position.y=mounted?1.25:0;player.rotation.y=heading;
      for(let i=0;i<2;i++)legs[i].rotation.x=mounted?-.8:Math.sin(time*10+i*Math.PI)*Math.min(speed/6,1)*.55;
      for(let i=0;i<4;i++)horseLegs[i].rotation.x=mounted?Math.sin(time*10+(i%3)*Math.PI)*Math.min(Math.abs(speed)/7,1)*.5:0;
      torso.position.y=1.22+(mounted?Math.sin(time*10)*Math.min(Math.abs(speed)/100,.05):0);
      const target=position.clone().add(new THREE.Vector3(0,mounted?2.6:1.5,0));const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
      ray.set(target,offset);const hits=ray.intersectObjects(wallMeshes);const distance=Math.min(mounted?8:6,hits.length?Math.max(.6,hits[0].distance-.35):20);camera.position.copy(target).addScaledVector(offset,distance);camera.lookAt(target);
      renderer.render(scene,camera);
      if(now-lastHud>120){lastHud=now;setStatus({mounted,near:position.distanceTo(horse.position)<3.5,speed:Math.round(Math.abs(speed)*3.6),distance:Math.round(travel)});}
    }frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',pointerUp);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerlockchange',lockChange);renderer.domElement.removeEventListener('mousedown',pointerDown);if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});mats.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
  }, []);
  return <main className="game-shell">
    <div ref={host} className="viewport" aria-label="Üç boyutlu kale antrenman alanı" />
    <header className="topbar"><div className="brand"><span className="sigil">♜</span><div><strong>SINIR KALESİ</strong><small>HAREKET PROTOTİPİ · 0.1</small></div></div><span className="map-label">KUZEY AVLUSU <i /> SERBEST ANTRENMAN</span><button onClick={()=>{commands.current.reset();}}>↺ Baştan başla</button></header>
    <aside className="objective"><span className="eyebrow">İLK KEŞİF</span><h2>Kaleyi tanı.</h2><p>Avluda dolaş, atına bin ve<br/>açık alanda hız kazan.</p><div className="progress"><span style={{width:`${Math.min(status.distance/100,1)*100}%`}} /></div><small>{Math.min(status.distance,100)} / 100 m keşfedildi</small></aside>
    <div className="crosshair" aria-hidden="true">·</div>
    {!playing && <section className="start-panel"><span className="eyebrow">SINIRDA BİR SABAH</span><h1>Atına bin.<br/><em>Avlu seni bekliyor.</em></h1><p>İlk adım: hareketi hisset.<br/>Bu alan tek oyunculu bir deneme; savaş ve online maçlar sonraki aşamada.</p>{error?<p role="alert">{error}</p>:<button className="primary" onClick={()=>commands.current.play()}>Avluya gir <span>→</span></button>}<small>Masaüstü · Klavye ve fare<br/>Fare kilidi desteklenmezse basılı tutup sürükle.</small></section>}
    {playing&&(status.mounted||status.near)&&<button className="interact" onClick={()=>commands.current.mount()}><kbd>E</kbd> {status.mounted?'Attan in':'Ata bin'}</button>}
    <footer className="hud"><div className="rider"><div className="avatar">{status.mounted?'♞':'♜'}</div><div><small>MAVİ TAKIM · KEŞİF</small><strong>{status.mounted?'Atlı':'Yaya'} <span> {status.speed} km/sa</span></strong></div></div><div className="controls"><span><kbd>W A S D</kbd> Hareket</span><span><kbd>FARE</kbd> Kamera</span><span><kbd>SHIFT</kbd> Hızlan</span><span><kbd>E</kbd> Bin / in</span><span><kbd>ESC</kbd> Duraklat</span></div><span className="prototype">TEK OYUNCULU<br/><b>Hareket denemesi</b></span></footer>
  </main>;
}

