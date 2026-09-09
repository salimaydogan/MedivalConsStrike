'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import MobileControls from '../../components/mobile-controls';
import { createMatch, joinMatch, stepMatch } from '../../lib/match.mjs';
import { WORLD_SOLIDS } from '../../lib/world.mjs';
import { swordAngle } from '../../lib/combat.mjs';

type Match = ReturnType<typeof createMatch>;
type Actor = Match['actors'][number];
type ServerResponse = {
  match: Match;
  players: number;
  owner?: boolean;
  events?: {
    type: string;
    id: string;
    by?: string;
    signal?: string;
    team?: string;
    serial: number;
  }[];
  token: string;
  playerId: string;
  code: string;
  error?: string;
};
const emptyInput = () => ({
  forward: 0,
  side: 0,
  yaw: 0,
  sprint: false,
  guard: false,
  attack: false,
  dodge: false,
});
export default function Battle() {
  const host = useRef<HTMLDivElement>(null);
  const [touch, setTouch] = useState(false),
    [team, setTeam] = useState('blue'),
    [size, setSize] = useState(2);
  const [hud, setHud] = useState({
    health: 100,
    stamina: 100,
    blue: 0,
    red: 0,
    remaining: 300,
    respawn: 0,
    protection: 0,
    phase: 'lobby',
    paused: false,
    hurt: 0,
    message: '',
    roster: [] as {
      id: string;
      name: string;
      team: string;
      bot: boolean;
      kills: number;
      deaths: number;
    }[],
  });
  const [networkMode, setNetworkMode] = useState(false),
    [serverUrl, setServerUrl] = useState('http://localhost:3001'),
    [roomCode, setRoomCode] = useState(''),
    [connecting, setConnecting] = useState(false),
    [connection, setConnection] = useState({
      code: '',
      players: 0,
      owner: false,
    }),
    [signalText, setSignalText] = useState('');
  const [error, setError] = useState(''),
    [scores, setScores] = useState(false);
  const api = useRef({
    connect: async (
      _url: string,
      _code: string,
      _team: string,
      _size: number,
    ) => {},
    signal: (_signal: string) => {},
    start: (_team: string, _size: number) => {},
    resume: () => {},
    pause: () => {},
    move: (_x: number, _y: number) => {},
    look: (_x: number, _y: number) => {},
    attack: () => {},
    dodge: () => {},
    guard: (_v: boolean) => {},
    sprint: (_v: boolean) => {},
    mount: () => {},
    mode: (_v: boolean) => {},
  });
  useEffect(() => {
    if (!host.current) return;
    const root = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        '3B görüntü başlatılamadı. Tarayıcının donanım hızlandırmasını kontrol et.',
      );
      return;
    }
    let mobile = matchMedia('(pointer: coarse)').matches;
    setTouch(mobile);
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    root.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa6bfca);
    scene.fog = new THREE.Fog(0xa6bfca, 55, 120);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
    scene.add(new THREE.HemisphereLight(0xe2f0ff, 0x555637, 2.5));
    const sun = new THREE.DirectionalLight(0xffe4b9, 3);
    sun.position.set(-20, 35, 18);
    sun.castShadow = true;
    sun.shadow.normalBias = 0.05;
    sun.shadow.bias = -0.00015;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
      far: 100,
    });
    scene.add(sun);
    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const material = (color: number) => {
      if (!materials.has(color))
        materials.set(
          color,
          new THREE.MeshStandardMaterial({
            color,
            roughness: 0.9,
            flatShading: true,
          }),
        );
      return materials.get(color)!;
    };
    const box = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: number,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material(color),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    box(scene, 180, 0.3, 180, 0, -0.2, 0, 0x6f8060);
    box(scene, 62, 0.1, 62, 0, 0, 0, 0xaca381);
    box(scene, 8, 0.02, 57, 0, 0.06, 0, 0xc4b99a);
    const walls = WORLD_SOLIDS.map((o) =>
      box(scene, o.w, o.h, o.d, o.x, o.h / 2, o.z, o.color),
    );
    for (let n = -30; n <= 30; n += 3)
      for (const s of [-1, 1]) {
        box(scene, 1.5, 1.2, 2, n, 7.6, s * 32, 0x858b80);
        box(scene, 2, 1.2, 1.5, s * 32, 7.6, n, 0x858b80);
      }
    for (const z of [-26, 26]) {
      box(scene, 15, 0.04, 5, 0, 0.1, z, z > 0 ? 0x426e7b : 0x985c4c);
      box(scene, 0.12, 7, 0.12, -8, 3.5, z, 0x594b36);
      box(scene, 2.2, 2, 0.12, -6.9, 5.7, z, z > 0 ? 0x327795 : 0xad4f40);
    }
    let playerId = 'local';
    const models = new Map<
      string,
      {
        group: THREE.Group;
        legs: THREE.Group[];
        arms: THREE.Group[];
        shield: THREE.Mesh;
        bar: THREE.Mesh;
        halo: THREE.Mesh;
      }
    >();
    const limb = (
      parent: THREE.Object3D,
      x: number,
      y: number,
      length: number,
      color: number,
    ) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      parent.add(g);
      box(g, 0.22, length, 0.22, 0, -length / 2, 0, color);
      return g;
    };
    const addActor = (a: Actor) => {
      const group = new THREE.Group();
      scene.add(group);
      const color = a.team === 'blue' ? 0x316f8b : 0xa94f40;
      box(group, 0.7, 0.85, 0.42, 0, 1.22, 0, color);
      box(group, 0.48, 0.46, 0.45, 0, 1.9, 0, 0xb9bfc0);
      box(group, 0.34, 0.1, 0.03, 0, 1.91, -0.24, 0x25343b);
      const legs = [
        limb(group, -0.2, 0.85, 0.7, 0x3e4442),
        limb(group, 0.2, 0.85, 0.7, 0x3e4442),
      ];
      legs.forEach((g) => box(g, 0.25, 0.14, 0.4, 0, -0.69, -0.07, 0x302f2c));
      const arms = [
        limb(group, -0.5, 1.58, 0.65, 0x9aabb0),
        limb(group, 0.5, 1.58, 0.65, 0x9aabb0),
      ];
      box(arms[1], 0.12, 0.85, 0.12, 0, -0.85, -0.2, 0xc0c6c2);
      box(arms[1], 0.42, 0.09, 0.18, 0, -0.5, -0.2, 0xc3a264);
      const shield = box(arms[0], 0.12, 0.8, 0.65, -0.14, -0.4, -0.06, color);
      box(group, 1, 0.1, 0.09, 0, 2.55, 0, 0x333d38);
      const bar = box(
        group,
        0.95,
        0.06,
        0.1,
        0,
        2.55,
        0.02,
        a.team === 'blue' ? 0x76d1e8 : 0xf49375,
      );
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.8, 24),
        new THREE.MeshBasicMaterial({
          color:
            a.id === playerId
              ? 0xf3d08b
              : a.team === 'blue'
                ? 0x66c4e6
                : 0xe86c51,
          side: THREE.DoubleSide,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.08;
      group.add(halo);
      models.set(a.id, { group, legs, arms, shield, bar, halo });
    };
    let match: Match | null = null,
      paused = false,
      input = emptyInput(),
      pitch = 0.38,
      side = 0,
      forward = 0,
      frame = 0,
      last = performance.now(),
      lastHud = 0,
      hurt = 0,
      message = '',
      messageUntil = 0,
      accumulator = 0,
      cameraReady = false;
    let online: null | {
        url: string;
        code: string;
        token: string;
        owner: boolean;
        sequence: number;
        lastPoll: number;
        busy: boolean;
        serial: number;
        failures: number;
      } = null,
      disposed = false;
    const signalLabels: Record<string, string> = {
      together: 'Birlikte ilerleyelim',
      help: 'Yardıma ihtiyacım var',
      thanks: 'Teşekkürler!',
      gg: 'İyi oyundu!',
    };
    const request = async (
      url: string,
      path: string,
      body: object,
      token?: string,
    ) => {
      const response = await fetch(url + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      const value = (await response.json()) as ServerResponse;
      if (!response.ok)
        throw Object.assign(Error(value.error || 'Bağlantı kurulamadı'), {
          status: response.status,
        });
      return value;
    };
    const removeModels = () => {
      for (const m of models.values()) {
        scene.remove(m.group);
        m.group.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        (m.halo.material as THREE.Material).dispose();
      }
      models.clear();
    };
    const applySnapshot = (value: {
      match: Match;
      players: number;
      owner?: boolean;
      events?: {
        type: string;
        id: string;
        by?: string;
        signal?: string;
        team?: string;
        serial: number;
      }[];
    }) => {
      if (disposed) return;
      const oldHealth =
        match?.actors.find((a) => a.id === playerId)?.health ?? 100;
      match = value.match;
      const me = match.actors.find((a) => a.id === playerId);
      if (!me) throw Error('Oyuncu oturumu bulunamadı');
      if (me.health < oldHealth) {
        hurt = 0.5;
        beep(85);
      }
      if (oldHealth === 0 && me.health > 0) {
        input.yaw = me.heading;
        cameraReady = false;
      }
      for (const e of value.events || []) {
        if (!online || e.serial <= online.serial) continue;
        online.serial = e.serial;
        if (e.type === 'signal' && (e.team === me.team || e.signal === 'gg')) {
          message =
            (match.actors.find((a) => a.id === e.id)?.name || 'Oyuncu') +
            ': ' +
            (signalLabels[e.signal || ''] || '');
          messageUntil = match.elapsed + 4;
        }
        if (e.type === 'kill') {
          message =
            (match.actors.find((a) => a.id === e.by)?.name || 'Oyuncu') +
            ' → ' +
            (match.actors.find((a) => a.id === e.id)?.name || 'Oyuncu');
          messageUntil = match.elapsed + 3;
        }
      }
      setConnection((c) => ({
        ...c,
        players: value.players,
        owner: value.owner ?? c.owner,
      }));
    };
    const keys = new Set<string>();
    const ray = new THREE.Raycaster();
    let audio: AudioContext | undefined;
    const beep = (freq: number) => {
      if (audio?.state !== 'running') return;
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.045, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.17);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    };
    const release = () => {
      keys.clear();
      side = forward = 0;
      input = { ...emptyInput(), yaw: input.yaw };
    };
    const pause = () => {
      if (!match || match.phase === 'finished') return;
      paused = true;
      release();
      setHud((h) => ({ ...h, paused: true }));
      if (document.pointerLockElement === renderer.domElement)
        document.exitPointerLock();
    };
    const resume = () => {
      if (!match || match.phase === 'finished') return;
      paused = false;
      last = performance.now();
      accumulator = 0;
      try {
        audio ??= new AudioContext();
        void audio.resume().catch(() => {});
      } catch {}
      if (!mobile) renderer.domElement.requestPointerLock?.()?.catch(() => {});
      setHud((h) => ({ ...h, paused: false }));
    };
    const start = (team: string, size: number) => {
      if (online) {
        const session = online;
        void request(
          session.url,
          '/rooms/' + session.code + '/restart',
          {},
          session.token,
        )
          .then((value) => {
            if (disposed || online !== session) return;
            applySnapshot(value);
            cameraReady = false;
            resume();
          })
          .catch((e) => setError(e.message));
        return;
      }
      removeModels();
      match = createMatch({ teamSize: size });
      playerId = 'local';
      const p = joinMatch(match, playerId, team, 'Sen');
      match.actors.forEach(addActor);
      release();
      input.yaw = p.heading;
      pitch = 0.38;
      hurt = 0;
      message = 'Takımınla ilerle · 15 skora ilk ulaşan kazanır';
      messageUntil = 4;
      cameraReady = false;
      setHud((h) => ({ ...h, phase: 'playing', paused: false }));
      resume();
    };
    const connect = async (
      rawUrl: string,
      code: string,
      team: string,
      size: number,
    ) => {
      setConnecting(true);
      setError('');
      try {
        const url = new URL(rawUrl);
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw Error('Geçerli bir sunucu adresi gir');
        if (location.protocol === 'https:' && url.protocol === 'http:')
          throw Error(
            'Bu sayfada HTTPS sunucusu gerekli. Yerel test için oyunu localhost üzerinden aç.',
          );
        const base = url.origin;
        const value = await request(
          base,
          code ? '/rooms/' + code.trim().toUpperCase() + '/join' : '/rooms',
          code ? { team } : { team, teamSize: size },
        );
        if (disposed) return;
        removeModels();
        playerId = value.playerId;
        online = {
          url: base,
          code: value.code,
          token: value.token,
          owner: !code,
          sequence: 0,
          lastPoll: 0,
          busy: false,
          serial: 0,
          failures: 0,
        };
        setConnection({
          code: value.code,
          players: value.players,
          owner: !code,
        });
        applySnapshot(value);
        match!.actors.forEach(addActor);
        release();
        input.yaw = match!.actors.find((a) => a.id === playerId)!.heading;
        cameraReady = false;
        setHud((h) => ({ ...h, phase: 'playing', paused: false }));
        resume();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sunucuya bağlanılamadı');
      } finally {
        setConnecting(false);
      }
    };
    const signal = (signal: string) => {
      if (!online) {
        setSignalText('Takım çağrıları online odada kullanılabilir.');
        return;
      }
      const session = online;
      void request(
        session.url,
        '/rooms/' + session.code + '/signal',
        { signal },
        session.token,
      )
        .then(() => {
          if (!disposed) setSignalText(signalLabels[signal]);
        })
        .catch((e) => {
          if (!disposed) setSignalText(e.message);
        });
    };
    api.current = {
      connect,
      signal,
      start,
      resume,
      pause,
      mount: () => {},
      mode: (v) => {
        mobile = v;
        setTouch(v);
        renderer.setPixelRatio(Math.min(devicePixelRatio, v ? 1.25 : 1.7));
      },
      move: (x, y) => {
        side = x;
        forward = y;
      },
      look: (x, y) => {
        if (paused) return;
        input.yaw -= x * 0.005;
        pitch = THREE.MathUtils.clamp(pitch + y * 0.004, 0.12, 1.05);
      },
      attack: () => {
        if (!paused) input.attack = true;
      },
      dodge: () => {
        if (!paused) input.dodge = true;
      },
      guard: (v) => {
        input.guard = v;
      },
      sprint: (v) => {
        input.sprint = v;
      },
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        pause();
        return;
      }
      if (paused || !match || match.phase === 'finished') return;
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
        ].includes(e.code)
      )
        e.preventDefault();
      keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) input.dodge = true;
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const mouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement || paused) return;
      input.yaw -= e.movementX * 0.003;
      pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.002, 0.12, 1.05);
    };
    const attack = (e: MouseEvent) => {
      if (paused || !match) return;
      if (e.button === 0) input.attack = true;
      if (e.button === 2) input.guard = true;
    };
    const lift = (e: MouseEvent) => {
      if (e.button === 2) input.guard = false;
    };
    const context = (e: Event) => e.preventDefault();
    const visibility = () => {
      if (document.hidden) pause();
    };
    const lock = () => {
      if (!document.pointerLockElement && !mobile) pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousemove', mouse);
    window.addEventListener('mouseup', lift);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerlockchange', lock);
    renderer.domElement.addEventListener('mousedown', attack);
    renderer.domElement.addEventListener('contextmenu', context);
    const resize = () => {
      renderer.setSize(root.clientWidth, root.clientHeight);
      camera.aspect = root.clientWidth / root.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    camera.position.set(0, 18, 32);
    camera.lookAt(0, 0, 0);
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      hurt = Math.max(0, hurt - dt);
      if (match) {
        if (online && now - online.lastPoll >= 50 && !online.busy) {
          const session = online;
          session.lastPoll = now;
          session.busy = true;
          const controls = {
            ...input,
            forward: paused
              ? 0
              : THREE.MathUtils.clamp(
                  forward +
                    Number(keys.has('KeyW') || keys.has('ArrowUp')) -
                    Number(keys.has('KeyS') || keys.has('ArrowDown')),
                  -1,
                  1,
                ),
            side: paused
              ? 0
              : THREE.MathUtils.clamp(
                  side +
                    Number(keys.has('KeyD') || keys.has('ArrowRight')) -
                    Number(keys.has('KeyA') || keys.has('ArrowLeft')),
                  -1,
                  1,
                ),
            sprint:
              !paused &&
              (input.sprint || keys.has('ShiftLeft') || keys.has('ShiftRight')),
            guard: !paused && input.guard,
            attack: !paused && input.attack,
            dodge: !paused && input.dodge,
          };
          input.attack = false;
          input.dodge = false;
          void request(
            session.url,
            '/rooms/' + session.code + '/input',
            { type: 'move', sequence: ++session.sequence, ...controls },
            session.token,
          )
            .then((value) => {
              if (disposed || online !== session) return;
              session.failures = 0;
              setError('');
              applySnapshot(value);
            })
            .catch((e) => {
              if (disposed || online !== session) return;
              if (e.status === 401 || e.status === 404) {
                online = null;
                match = null;
                removeModels();
                setConnection({ code: '', players: 0, owner: false });
                setHud((h) => ({ ...h, phase: 'lobby', paused: false }));
                setError('Oturum sona erdi. Odaya yeniden katılabilirsin.');
                return;
              }
              session.failures++;
              setError('Bağlantı kesildi: ' + e.message);
              if (session.failures >= 3) {
                paused = true;
                release();
                setHud((h) => ({ ...h, paused: true }));
              }
            })
            .finally(() => {
              session.busy = false;
            });
        }
        if (!online && !paused && match.phase === 'playing') {
          accumulator = Math.min(accumulator + dt, 0.1);
          while (accumulator >= 1 / 60) {
            input.forward = THREE.MathUtils.clamp(
              forward +
                Number(keys.has('KeyW') || keys.has('ArrowUp')) -
                Number(keys.has('KeyS') || keys.has('ArrowDown')),
              -1,
              1,
            );
            input.side = THREE.MathUtils.clamp(
              side +
                Number(keys.has('KeyD') || keys.has('ArrowRight')) -
                Number(keys.has('KeyA') || keys.has('ArrowLeft')),
              -1,
              1,
            );
            stepMatch(
              match,
              {
                local: {
                  ...input,
                  sprint:
                    input.sprint ||
                    keys.has('ShiftLeft') ||
                    keys.has('ShiftRight'),
                },
              },
              1 / 60,
            );
            input.attack = false;
            input.dodge = false;
            accumulator -= 1 / 60;
            for (const e of match.events) {
              if (e.id === playerId && e.type === 'hit') {
                hurt = 0.5;
                beep(85);
              }
              if (e.type === 'block' && e.id === playerId) beep(700);
              if (e.type === 'hit' && e.by === playerId) beep(180);
              if (e.type === 'kill') {
                const killer = match.actors.find((a) => a.id === e.by),
                  victim = match.actors.find((a) => a.id === e.id);
                message = `${killer?.name} → ${victim?.name}`;
                messageUntil = match.elapsed + 3;
              }
              if (e.type === 'respawn' && e.id === playerId) {
                input.yaw = match.actors.find(
                  (a) => a.id === playerId,
                )!.heading;
                cameraReady = false;
              }
            }
          }
        }
        for (const [id, model] of models)
          if (!match.actors.some((a) => a.id === id)) {
            scene.remove(model.group);
            model.group.traverse((o) => {
              if (o instanceof THREE.Mesh) o.geometry.dispose();
            });
            (model.halo.material as THREE.Material).dispose();
            models.delete(id);
          }
        for (const a of match.actors) {
          if (!models.has(a.id)) addActor(a);
          const m = models.get(a.id)!;
          m.group.position.set(a.x, 0, a.z);
          m.group.rotation.set(
            0,
            a.heading,
            a.health === 0 ? Math.min(1.4, (4 - a.respawn) * 3) : 0,
          );
          m.bar.scale.x = Math.max(0.001, a.health / 100);
          m.halo.visible = a.health > 0;
          m.halo.scale.setScalar(
            a.protection > 0 ? 1.2 + Math.sin(now * 0.006) * 0.1 : 1,
          );
          const weight = a.health > 0 ? Math.min(a.speed / 3.3, 1) : 0;
          for (let i = 0; i < 2; i++) {
            m.legs[i].rotation.x =
              Math.sin(a.gait + i * Math.PI) * 0.65 * weight;
            m.arms[i].rotation.x =
              -Math.sin(a.gait + i * Math.PI) * 0.3 * weight;
          }
          if (a.attackTime >= 0)
            m.arms[1].rotation.x = swordAngle(a.attackTime);
          m.arms[0].rotation.set(
            a.blocking ? 1.4 : 0,
            0,
            a.blocking ? -0.5 : 0,
          );
          if (a.blocking) {
            const inv = m.arms[0].quaternion.clone().invert();
            m.shield.quaternion
              .copy(inv)
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(0, 1, 0),
                  Math.PI / 2,
                ),
              );
            m.shield.position
              .set(-0.25, 1.3, -0.72)
              .sub(m.arms[0].position)
              .applyQuaternion(inv);
          } else {
            m.shield.rotation.set(0, 0, 0);
            m.shield.position.set(-0.14, -0.4, -0.06);
          }
        }
        if (
          match.phase === 'finished' &&
          document.pointerLockElement === renderer.domElement
        )
          document.exitPointerLock();
        const me = match.actors.find((a) => a.id === playerId)!;
        const target = new THREE.Vector3(me.x, 1.5, me.z),
          distance = 6.5;
        const desired = target
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(input.yaw) * distance * Math.cos(pitch),
              2 + Math.sin(pitch) * distance,
              Math.cos(input.yaw) * distance * Math.cos(pitch),
            ),
          );
        const direction = desired.clone().sub(target);
        ray.set(target, direction.clone().normalize());
        const obstruction = ray.intersectObjects(walls)[0];
        if (obstruction && obstruction.distance < direction.length())
          desired
            .copy(target)
            .addScaledVector(
              direction.normalize(),
              Math.max(0.5, obstruction.distance - 0.25),
            );
        if (!cameraReady) {
          camera.position.copy(desired);
          cameraReady = true;
        } else camera.position.lerp(desired, 1 - Math.exp(-12 * dt));
        camera.lookAt(target);
        if (now - lastHud > 100) {
          lastHud = now;
          setHud({
            health: me.health,
            stamina: Math.round(me.stamina),
            blue: match.score.blue,
            red: match.score.red,
            remaining: Math.ceil(match.rules.duration - match.elapsed),
            respawn: Math.ceil(me.respawn),
            protection: Math.ceil(me.protection),
            phase: match.phase,
            paused,
            hurt,
            message: match.elapsed < messageUntil ? message : '',
            roster: match.actors.map((a) => ({
              id: a.id,
              name: a.name,
              team: a.team,
              bot: a.bot,
              kills: a.kills,
              deaths: a.deaths,
            })),
          });
        }
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      if (online)
        void request(
          online.url,
          '/rooms/' + online.code + '/leave',
          {},
          online.token,
        ).catch(() => {});
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousemove', mouse);
      window.removeEventListener('mouseup', lift);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', lock);
      renderer.domElement.removeEventListener('mousedown', attack);
      renderer.domElement.removeEventListener('contextmenu', context);
      if (document.pointerLockElement === renderer.domElement)
        document.exitPointerLock();
      void audio?.close().catch(() => {});
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of models.values())
        (m.halo.material as THREE.Material).dispose();
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  const started = hud.phase !== 'lobby',
    finished = hud.phase === 'finished';
  return (
    <main className={`game-shell battle-shell ${touch ? 'touch-game' : ''}`}>
      <div className="viewport" ref={host} />
      <header className="battle-top">
        <a href="/">♜ Talim avlusu</a>
        <span>
          KUZEY AVLUSU · {connection.code ? 'ONLINE ODA' : 'BOT MAÇI'}
        </span>
        <a href="/roadmap.html">Yol haritası ↗</a>
      </header>
      {started && connection.code && (
        <div className="room-badge">
          Oda {connection.code} · {connection.players} oyuncu
        </div>
      )}
      {started && error && (
        <p className="network-error" role="alert">
          {error}
        </p>
      )}
      {started && (
        <div className="match-score">
          <b className="blue-score">{hud.blue}</b>
          <div>
            <strong>
              {Math.floor(hud.remaining / 60)}:
              {String(hud.remaining % 60).padStart(2, '0')}
            </strong>
            <small>HEDEF 15</small>
          </div>
          <b className="red-score">{hud.red}</b>
        </div>
      )}
      {!started && (
        <section className="battle-menu">
          <span className="eyebrow">TEAM DEATHMATCH</span>
          <h1>
            Takımını seç.
            <br />
            <em>Meydana çık.</em>
          </h1>
          <p>
            Boş yerleri botlar doldurur. Rakibini devir, takımına skor kazandır.
            15 skor veya 5 dakika.
          </p>
          <div className="team-choice">
            <button
              aria-pressed={team === 'blue'}
              onClick={() => setTeam('blue')}
            >
              Mavi takım
            </button>
            <button
              aria-pressed={team === 'red'}
              onClick={() => setTeam('red')}
            >
              Kızıl takım
            </button>
          </div>
          <label className="control-mode">
            Takımlar
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            >
              <option value={2}>2 vs 2</option>
              <option value={5}>5 vs 5</option>
            </select>
          </label>
          <label className="control-mode">
            Kontroller
            <select
              value={touch ? 'touch' : 'keyboard'}
              onChange={(e) => api.current.mode(e.target.value === 'touch')}
            >
              <option value="touch">Dokunmatik</option>
              <option value="keyboard">Klavye ve fare</option>
            </select>
          </label>
          <label className="control-mode">
            Oyun
            <select
              value={networkMode ? 'online' : 'bots'}
              onChange={(e) => {
                setNetworkMode(e.target.value === 'online');
                setError('');
              }}
            >
              <option value="bots">Botlarla oyna</option>
              <option value="online">Online test odası</option>
            </select>
          </label>
          {networkMode && (
            <div className="room-fields">
              <label>
                Sunucu adresi
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://oyun-sunucusu…"
                />
              </label>
              <label>
                Oda kodu <small>(yeni oda için boş bırak)</small>
                <input
                  value={roomCode}
                  maxLength={6}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Örn. A12BC3"
                />
              </label>
              <small>
                Çalışan oyun sunucusu gerekir. Genel online sunucu henüz yayında
                değil.
              </small>
            </div>
          )}
          <button
            className="primary"
            disabled={connecting}
            onClick={() =>
              networkMode
                ? void api.current.connect(serverUrl, roomCode, team, size)
                : api.current.start(team, size)
            }
          >
            {connecting
              ? 'Bağlanıyor…'
              : networkMode
                ? roomCode
                  ? 'Odaya katıl →'
                  : 'Oda aç →'
                : 'Botlarla maça başla →'}
          </button>
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <small>
              Bu maç cihazında oynanır. İlk sürüm yaya kılıç–kalkan savaşıdır;
              atlı talim avluda devam ediyor.
            </small>
          )}
        </section>
      )}
      {started && !finished && (
        <>
          <div className="crosshair">·</div>
          <section className="battle-vitals">
            <span>{team === 'blue' ? 'MAVİ' : 'KIZIL'} TAKIM · SEN</span>
            <label>
              CAN {hud.health}
              <meter min="0" max="100" value={hud.health} />
            </label>
            <label>
              DAYANIKLILIK {hud.stamina}
              <meter min="0" max="100" value={hud.stamina} />
            </label>
            {hud.protection > 0 && hud.health > 0 && (
              <small>Doğma koruması · {hud.protection} sn</small>
            )}
          </section>
          <div className="battle-feed" role="status">
            {hud.message}
          </div>
          <button
            className="score-toggle"
            onClick={() => {
              api.current.pause();
              setScores(true);
            }}
          >
            Skor tablosu
          </button>
          {!touch && (
            <div className="battle-keys">
              WASD hareket · Sol tık kılıç · Sağ tık kalkan · Boşluk kaçın · ESC
              duraklat
            </div>
          )}
        </>
      )}
      <div className="damage-flash" style={{ opacity: hud.hurt / 0.5 }} />
      {started && hud.health === 0 && !finished && !hud.paused && (
        <div className="battle-respawn" role="status">
          <strong>Öldün</strong>
          <span>{hud.respawn} saniyede yeniden doğacaksın</span>
        </div>
      )}
      {touch && started && !hud.paused && !finished && hud.health > 0 && (
        <MobileControls
          input={api.current}
          mounted={false}
          near={false}
          showMount={false}
        />
      )}
      {started && connection.code && (
        <details className="team-signals">
          <summary>Takım çağrısı</summary>
          <div>
            {[
              ['together', 'Birlikte ilerleyelim'],
              ['help', 'Yardım!'],
              ['thanks', 'Teşekkürler'],
              ['gg', 'İyi oyun!'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => api.current.signal(id)}>
                {label}
              </button>
            ))}
            {signalText && <small role="status">{signalText}</small>}
          </div>
        </details>
      )}
      {(finished || hud.paused) && (
        <section className="battle-menu battle-overlay">
          <span className="eyebrow">
            {finished
              ? 'MAÇ SONU'
              : connection.code
                ? 'MENÜ · ONLINE MAÇ DEVAM EDİYOR'
                : 'OYUN DURAKLATILDI'}
          </span>
          <h1>
            {finished
              ? hud.blue === hud.red
                ? 'Berabere'
                : (team === 'blue' ? hud.blue > hud.red : hud.red > hud.blue)
                  ? 'Zafer!'
                  : 'Yenildin'
              : 'Soluklan.'}
          </h1>
          {(finished || scores) && (
            <table className="battle-table">
              <thead>
                <tr>
                  <th>Oyuncu</th>
                  <th>Skor</th>
                  <th>Ölüm</th>
                </tr>
              </thead>
              <tbody>
                {hud.roster.map((a) => (
                  <tr
                    key={a.id}
                    className={a.team === 'blue' ? 'blue-row' : 'red-row'}
                  >
                    <td>
                      {a.name} <small>{a.bot ? 'BOT' : 'OYUNCU'}</small>
                    </td>
                    <td>{a.kills}</td>
                    <td>{a.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!finished && (
            <button
              className="primary"
              onClick={() => {
                setScores(false);
                api.current.resume();
              }}
            >
              Maça dön →
            </button>
          )}
          <button
            disabled={!!connection.code && !connection.owner}
            className={finished ? 'primary' : 'secondary'}
            onClick={() => {
              setScores(false);
              api.current.start(team, size);
            }}
          >
            {connection.code && !connection.owner
              ? 'Yeni maçı oda sahibi başlatır'
              : 'Yeni maç'}
          </button>
          <a href="/">Talim avlusuna dön</a>
        </section>
      )}
    </main>
  );
}
