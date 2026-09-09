import * as THREE from 'three';
type Mat = (color: number) => THREE.MeshStandardMaterial;
export function makeWarrior(color: number, local: boolean, mat: Mat) {
  const group = new THREE.Group();
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
  // Layered cuirass, surcoat, leather belt and articulated armoured limbs.
  ell(group, 0x343e41, 0, 1.27, 0, 0.37, 0.47, 0.24);
  ell(group, 0x879497, 0, 1.37, -0.035, 0.37, 0.34, 0.245);
  box(group, color, 0, 1.22, -0.257, 0.25, 0.55, 0.025);
  box(group, 0x554437, 0, 0.98, 0, 0.68, 0.1, 0.46);
  box(group, 0xc8aa6b, 0, 0.98, -0.255, 0.13, 0.12, 0.045);
  const skirt = mesh(
    group,
    new THREE.CylinderGeometry(0.28, 0.4, 0.32, 10),
    color,
    0,
    0.88,
    0,
  );
  skirt.scale.z = 0.7;
  ell(group, 0xd0ab87, 0, 1.96, -0.015, 0.195, 0.245, 0.18);
  const helmet = ell(group, 0x8c979b, 0, 2.04, 0.025, 0.225, 0.225, 0.205);
  helmet.material = mat(0x8c979b);
  box(group, 0x32393c, 0, 2.01, -0.18, 0.34, 0.043, 0.06);
  box(group, 0xb7bfc0, 0, 1.92, -0.205, 0.045, 0.19, 0.055);
  for (const x of [-0.19, 0.19])
    box(group, 0x8c979b, x, 1.9, 0.01, 0.055, 0.25, 0.3);
  const arms: THREE.Group[] = [],
    legs: THREE.Group[] = [],
    knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.43, 1.58, 0);
    group.add(arm);
    arms.push(arm);
    ell(arm, 0x96a2a3, 0, -0.035, 0, 0.205, 0.16, 0.23);
    mesh(
      arm,
      new THREE.CylinderGeometry(0.12, 0.1, 0.3, 8),
      0x596569,
      0,
      -0.24,
      0,
    );
    ell(arm, 0x9da9aa, 0, -0.4, 0, 0.12, 0.1, 0.12);
    mesh(
      arm,
      new THREE.CylinderGeometry(0.11, 0.08, 0.24, 8),
      0x849094,
      0,
      -0.53,
      0,
    );
    ell(arm, 0x594838, 0, -0.69, 0, 0.09, 0.1, 0.09);
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
    ell(knee, 0xa1abab, 0, 0, -0.04, 0.135, 0.12, 0.13);
    mesh(
      knee,
      new THREE.CylinderGeometry(0.11, 0.08, 0.32, 9),
      0x778184,
      0,
      -0.18,
      0,
    );
    ell(knee, 0x393631, 0, -0.37, -0.065, 0.12, 0.1, 0.2);
  }
  const sword = new THREE.Group();
  arms[1].add(sword);
  box(sword, 0xd8e0df, 0, -1.12, -0.04, 0.065, 0.82, 0.035);
  box(sword, 0xc5a469, 0, -0.7, -0.04, 0.3, 0.045, 0.07);
  box(sword, 0x514031, 0, -0.61, -0.04, 0.065, 0.14, 0.065);
  const spear = new THREE.Group();
  arms[1].add(spear);
  mesh(
    spear,
    new THREE.CylinderGeometry(0.025, 0.025, 2.8, 7),
    0x795735,
    0,
    -0.75,
    0,
  );
  const tip = mesh(
    spear,
    new THREE.ConeGeometry(0.085, 0.38, 4),
    0xcbd5d4,
    0,
    -2.3,
    0,
  );
  tip.rotation.x = Math.PI;
  const bow = new THREE.Group();
  arms[0].add(bow);
  bow.position.set(0, -0.6, -0.18);
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
    .map((p) => new THREE.Vector3(p.x, p.y, 0));
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
  mesh(bow, new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), 0xddd2b0);
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
