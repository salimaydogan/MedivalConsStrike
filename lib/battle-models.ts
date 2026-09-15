import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
type Mat = (color: number) => THREE.MeshStandardMaterial;
export function makeWarrior(color: number, local: boolean, mat: Mat) {
  const group = new THREE.Group();
  // All warriors share the caller's material cache; armour catches light while
  // fabric and leather stay matte. No per-frame textures or extra lights.
  const steel = 0x78848b, edge = 0xa5afb3, leather = 0x49372b;
  for (const c of [steel, edge]) {
    const material = mat(c);
    material.metalness = 0.65;
    material.roughness = 0.38;
    material.flatShading = false;
  }
  const mesh = (
    p: THREE.Object3D,
    g: THREE.BufferGeometry,
    c: number,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const m = new THREE.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const ell = (
    p: THREE.Object3D,
    c: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const m = mesh(p, new THREE.SphereGeometry(1, 12, 8), c, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const box = (
    p: THREE.Object3D,
    c: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => mesh(p, new THREE.BoxGeometry(w, h, d), c, x, y, z);
  const body = new THREE.Group();
  group.add(body);
  // Tailored gambeson: waist, rib cage, shoulders and neck are distinct rings.
  const tailored = (points: number[][], c: number, depth: number) => {
    const piece = mesh(body, new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)), 16), c);
    piece.scale.z = depth;
    return piece;
  };
  tailored([[0,0.95],[0.27,0.95],[0.28,1.13],[0.335,1.4],[0.33,1.55],[0.18,1.66],[0.12,1.68],[0,1.68]],color,0.68);
  tailored([[0.13,1.61],[0.145,1.65],[0.14,1.77],[0.1,1.78]],0x40474a,0.9);
  // Quilted seams follow both sides of the tunic, visible from the chase camera.
  for (const side of [-1,1]) {
    for (let row=0;row<5;row++) for(let col=0;col<5;col++) {
      const x=(col-2)*0.105, y=1.09+row*0.105;
      const seam=box(body,0x514b43,x,y,side*(0.218-Math.abs(x)*0.17),0.006,0.13,0.004);
      seam.rotation.z=(row%2?1:-1)*0.65;
    }
    const strap=box(body,leather,side*0.15,1.4,-0.23,0.055,0.48,0.018);
    strap.rotation.z=side*0.16;
  }
  tailored([[0.27,0.96],[0.29,0.98],[0.29,1.065],[0.27,1.065]],leather,0.77);
  box(body,0xc8aa6b,0,1.025,-0.239,0.10,0.075,0.024);
  box(body,leather,0,1.025,-0.255,0.065,0.04,0.008);
  // Split coat tails leave room for the leg animation and mounted pose.
  for (const side of [-1,1]) {
    const tail=box(body,color,side*0.16,0.81,0.09,0.28,0.34,0.25);
    tail.rotation.z=side*0.06;
    box(body,0x80745c,side*0.3,0.81,0.09,0.014,0.34,0.26);
  }
  ell(body,0xc4a080,0,1.91,-0.02,0.16,0.20,0.155);
  // Open-faced ridged helmet, brow band, cheek guards and nasal protection.
  const helmet=mesh(body,new THREE.LatheGeometry([
    new THREE.Vector2(0.187,0),new THREE.Vector2(0.19,0.10),
    new THREE.Vector2(0.16,0.21),new THREE.Vector2(0.09,0.28),new THREE.Vector2(0,0.32),
  ],16),steel,0,1.94,0.015);
  helmet.scale.z=0.93;
  const band=mesh(body,new THREE.CylinderGeometry(0.194,0.194,0.045,16,1,true),edge,0,1.96,0.015);
  band.scale.z=0.93;
  box(body,0x2c2926,0,1.925,-0.158,0.22,0.035,0.018);
  box(body,edge,0,1.9,-0.184,0.032,0.17,0.027);
  for(const side of [-1,1]) {
    const cheek=box(body,steel,side*0.15,1.86,-0.006,0.035,0.19,0.18);
    cheek.rotation.z=side*0.13;
    ell(body,edge,side*0.17,1.965,-0.07,0.018,0.018,0.018);
  }
  const arms: THREE.Group[] = [],
    legs: THREE.Group[] = [],
    knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.43, 1.58, 0);
    group.add(arm);
    arms.push(arm);
    ell(arm, steel, 0, -0.035, 0, 0.16, 0.13, 0.18);
    ell(arm, edge, 0, -0.12, 0, 0.155, 0.045, 0.17);
    mesh(
      arm,
      new THREE.CylinderGeometry(0.12, 0.1, 0.3, 8),
      color,
      0,
      -0.24,
      0,
    );
    ell(arm, steel, 0, -0.4, 0, 0.105, 0.08, 0.11);
    mesh(
      arm,
      new THREE.CylinderGeometry(0.11, 0.08, 0.24, 8),
      steel,
      0,
      -0.53,
      0,
    );
    // Closed glove surrounds the grip socket; thumb is offset from the knuckles.
    box(arm, leather, 0, -0.69, 0.025, 0.12, 0.13, 0.08);
    for(let finger=0;finger<3;finger++)
      ell(arm,leather,0,-0.65-finger*0.033,-0.027,0.061,0.016,0.041);
    ell(arm,leather,side*0.055,-0.66,-0.01,0.029,0.05,0.035);
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, 0.87, 0);
    group.add(leg);
    legs.push(leg);
    mesh(
      leg,
      new THREE.CylinderGeometry(0.145, 0.11, 0.37, 9),
      0x4d585a,
      0,
      -0.185,
      0,
    );
    const knee = new THREE.Group();
    knee.position.y = -0.37;
    leg.add(knee);
    knees.push(knee);
    ell(knee, steel, 0, 0, -0.04, 0.115, 0.105, 0.115);
    mesh(
      knee,
      new THREE.CylinderGeometry(0.11, 0.08, 0.32, 9),
      leather,
      0,
      -0.18,
      0,
    );
    ell(knee, leather, 0, -0.37, -0.065, 0.10, 0.08, 0.19);
    box(knee,0x272725,0,-0.428,-0.06,0.19,0.028,0.31);
  }
  const elbows = arms.map((arm) => {
    const elbow = new THREE.Group();
    elbow.position.y = -0.39;
    for (const child of [...arm.children])
      if (child.position.y <= -0.39) {
        arm.remove(child);
        child.position.y += 0.39;
        elbow.add(child);
      }
    arm.add(elbow);
    return elbow;
  });
  const grips = elbows.map((elbow) => {
    const grip = new THREE.Group();
    grip.position.y = -0.3;
    elbow.add(grip);
    return grip;
  });
  // Collapse rigid detail by material at each joint, never across animated joints.
  // Many quilt stitches still cost one draw call per material, not one per stitch.
  for (const part of [body, ...arms, ...elbows, ...legs, ...knees]) {
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...part.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const bucket = buckets.get(child.material) || [];
      bucket.push(child); buckets.set(child.material,bucket);
    }
    for (const [material, pieces] of buckets) {
      if (pieces.length < 2) continue;
      const geometries = pieces.map(piece=>{
        piece.updateMatrix();
        return piece.geometry.clone().applyMatrix4(piece.matrix);
      });
      const geometry = mergeGeometries(geometries);
      geometries.forEach(g=>g.dispose());
      if (!geometry) continue;
      pieces.forEach(piece=>{part.remove(piece);piece.geometry.dispose();});
      const combined = new THREE.Mesh(geometry,material);
      combined.castShadow=true; combined.receiveShadow=true;
      part.add(combined);
    }
  }
  const sword = new THREE.Group();
  grips[1].add(sword);
  box(sword, 0x514031, 0, 0, 0, 0.065, 0.18, 0.065);
  box(sword, 0xc5a469, 0, -0.13, 0, 0.3, 0.045, 0.07);
  box(sword, 0xd8e0df, 0, -0.56, 0, 0.065, 0.82, 0.035);
  const spear = new THREE.Group();
  grips[1].add(spear);
  mesh(
    spear,
    new THREE.CylinderGeometry(0.025, 0.025, 2.8, 7),
    0x795735,
    0,
    -0.06,
    0,
  );
  const tip = mesh(
    spear,
    new THREE.ConeGeometry(0.085, 0.38, 4),
    0xcbd5d4,
    0,
    -1.61,
    0,
  );
  tip.rotation.x = Math.PI;
  const bow = new THREE.Group();
  grips[0].add(bow);
  const arc = new THREE.EllipseCurve(
    0,
    0,
    0.24,
    0.6,
    -Math.PI / 2,
    Math.PI / 2,
    false,
    0,
  )
    .getPoints(16)
    .map((p) => new THREE.Vector3(p.x - 0.24, p.y, 0));
  mesh(
    bow,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(arc),
      16,
      0.026,
      5,
      false,
    ),
    0x8d6239,
  );
  const bowStrings = [-1, 1].map(() =>
    mesh(bow, new THREE.CylinderGeometry(0.007, 0.007, 1, 5), 0xeee4ca),
  );
  const nockedArrow = mesh(
    bow,
    new THREE.CylinderGeometry(0.018, 0.018, 0.85, 5),
    0xe8cc89,
  );
  nockedArrow.geometry.rotateZ(Math.PI / 2);
  const shield = mesh(
    arms[0],
    new THREE.CylinderGeometry(0.36, 0.31, 0.09, 10),
    color,
    -0.14,
    -0.4,
    -0.06,
  );
  shield.geometry.rotateZ(Math.PI / 2);
  const boss = ell(shield, 0xb1b9b6, -0.065, 0, 0, 0.075, 0.12, 0.12);
  const bar = box(group, 0x83cf9c, 0, 2.5, 0, 0.95, 0.055, 0.055);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.73, 24),
    new THREE.MeshBasicMaterial({
      color: local ? 0xf3d08b : color,
      side: THREE.DoubleSide,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.045;
  group.add(halo);
  const trail = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.55, 24, 1, -1.1, 2.2),
    new THREE.MeshBasicMaterial({
      color: 0xffd994,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  trail.rotation.x = -Math.PI / 2;
  trail.position.set(0.2, 1.25, -0.8);
  group.add(trail);
  return {
    group,
    arms,
    legs,
    knees,
    elbows,
    grips,
    bowStrings,
    nockedArrow,
    sword,
    spear,
    bow,
    shield,
    bar,
    halo,
    trail,
  };
}
export function makeHorse(mat: Mat) {
  const group = new THREE.Group();
  const ell = (
    c: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  ell(0x73503a, 0, 1.38, 0, 0.47, 0.55, 0.9);
  const neck = ell(0x805b40, 0, 1.96, -0.65, 0.28, 0.68, 0.33);
  neck.rotation.x = -0.35;
  ell(0x886043, 0, 2.4, -1.02, 0.24, 0.27, 0.48);
  for (const x of [-0.16, 0.16]) {
    ell(0x5e422f, x, 2.73, -0.85, 0.07, 0.21, 0.07);
    ell(0x151d1c, x * 1.4, 2.47, -1.06, 0.025, 0.03, 0.035);
  }
  ell(0x3d342c, 0, 2.31, -1.4, 0.22, 0.16, 0.14);
  ell(0x292c2a, 0, 2.27, -0.55, 0.1, 0.42, 0.09);
  ell(0x372f27, 0, 1.02, 0.92, 0.11, 0.55, 0.13);
  ell(0x243b46, 0, 1.92, 0.08, 0.5, 0.1, 0.45);
  ell(0x4d3429, 0, 2.03, 0.12, 0.34, 0.13, 0.3);
  const legs: THREE.Group[] = [];
  for (const x of [-0.31, 0.31])
    for (const z of [-0.58, 0.58]) {
      const leg = new THREE.Group();
      leg.position.set(x, 1.1, z);
      group.add(leg);
      legs.push(leg);
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.065, 0.92, 8),
        mat(0x563e2d),
      );
      m.position.y = -0.46;
      m.castShadow = true;
      leg.add(m);
      const hoof = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 0.24),
        mat(0x302d28),
      );
      hoof.position.set(0, -0.95, -0.025);
      leg.add(hoof);
    }
  return { group, legs };
}
