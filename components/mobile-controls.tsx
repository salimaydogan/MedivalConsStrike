'use client';
import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

export type TouchInput = {
  move: (x: number, y: number) => void;
  look: (x: number, y: number) => void;
  attack: () => void;
  dodge: () => void;
  guard: (held: boolean) => void;
  sprint: (held: boolean) => void;
  mount: () => void;
  pause: () => void;
};

export default function MobileControls({ input, mounted, near, showMount=true }: { input: TouchInput; mounted: boolean; near: boolean; showMount?:boolean }) {
  const [stick,setStick]=useState({x:0,y:0});
  const stickId=useRef<number|null>(null);
  const camera=useRef<{id:number;x:number;y:number}|null>(null);
  const stopStick=()=>{stickId.current=null;setStick({x:0,y:0});input.move(0,0);};
  const updateStick=(e:PointerEvent<HTMLDivElement>)=>{
    const rect=e.currentTarget.getBoundingClientRect(),radius=rect.width*.32;
    let x=(e.clientX-rect.left-rect.width/2)/radius,y=(e.clientY-rect.top-rect.height/2)/radius;
    const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
    setStick({x:x*radius,y:y*radius});input.move(length<.15?0:x,length<.15?0:-y);
  };
  const hold=(action:(held:boolean)=>void,label:string,className='')=><button className={className}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);action(true);}}
    onPointerUp={()=>action(false)} onPointerCancel={()=>action(false)} onLostPointerCapture={()=>action(false)}>{label}</button>;
  return <div className="touch-controls">
    <div className="touch-look" aria-label="Kamera: parmağınla sürükle"
      onPointerDown={e=>{if(camera.current)return;e.currentTarget.setPointerCapture(e.pointerId);camera.current={id:e.pointerId,x:e.clientX,y:e.clientY};}}
      onPointerMove={e=>{const last=camera.current;if(last?.id!==e.pointerId)return;input.look(e.clientX-last.x,e.clientY-last.y);camera.current={id:e.pointerId,x:e.clientX,y:e.clientY};}}
      onPointerUp={()=>{camera.current=null;}} onPointerCancel={()=>{camera.current=null;}} onLostPointerCapture={()=>{camera.current=null;}} />
    <button className="touch-pause" onClick={input.pause} aria-label="Oyunu duraklat">Ⅱ</button>
    <div className="touch-stick" aria-label="Hareket çubuğu" onPointerDown={e=>{if(stickId.current!==null)return;e.currentTarget.setPointerCapture(e.pointerId);stickId.current=e.pointerId;updateStick(e);}}
      onPointerMove={e=>{if(stickId.current===e.pointerId)updateStick(e);}}
      onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
      <span style={{transform:`translate(${stick.x}px, ${stick.y}px)`}} />
    </div>
    <div className="touch-actions">{hold(input.sprint,'Hızlan')}{hold(input.guard,'Kalkan')}
      <button className="touch-attack" onPointerDown={e=>{e.preventDefault();input.attack();}}>Kılıç</button>
      <button disabled={mounted} onPointerDown={e=>{e.preventDefault();input.dodge();}}>Kaçın</button>
      {showMount&&<button disabled={!mounted&&!near} onClick={input.mount}>{mounted?'Attan in':near?'Ata bin':'Ata yaklaş'}</button>}
    </div>
  </div>;
}
