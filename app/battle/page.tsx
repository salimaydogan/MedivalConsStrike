'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import MobileControls from '../../components/mobile-controls';
import { createMatch, joinMatch, stepMatch } from '../../lib/match.mjs';
import { WORLD_SOLIDS, DEFENSE_STRUCTURES } from '../../lib/world.mjs';
import { WEAPONS } from '../../lib/weapons.mjs';
import { makeWarrior, makeHorse } from '../../lib/battle-models';
import { bowDraw } from '../../lib/bow-draw.mjs';
import { meleePose } from '../../lib/melee-pose.mjs';
import { attackDirection } from '../../lib/directional-combat.mjs';
import { bowSpread } from '../../lib/bow-aim.mjs';

type Match = ReturnType<typeof createMatch>;
type Actor = Match['actors'][number];
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
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
  attackHeld: false,
  cancelAttack: false,
  attackDirection: 'right',
  dodge: false,
  jump: false,
  mount: false,
  weapon: 'sword',
});
export default function Battle() {
  const host = useRef<HTMLDivElement>(null);
  const spectatorPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const [touch, setTouch] = useState(false),
    [team, setTeam] = useState('blue'),
    [size, setSize] = useState(2),
    [gameMode, setGameMode] = useState<'competitive' | 'tdm'>('competitive');
  const [hud, setHud] = useState({
    health: 100,
    maxHealth: 100,
    bowCharge: 0,
    bowSpread: 0.132,
    maxStamina: 100,
    mounted: false,
    near: false,
    weapon: 'sword',
    stamina: 100,
    blue: 0,
    red: 0,
    remaining: 300,
    respawn: 0,
    roundBreak: 0,
    protection: 0,
    phase: 'lobby',
    paused: false,
    hurt: 0,
    message: '',
    mode: 'tdm',
    round: 1,
    spectating: '',
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
    [serverUrl, setServerUrl] = useState('https://server.demirtunakyk.com'),
    [roomCode, setRoomCode] = useState(''),
    [fillBots, setFillBots] = useState(true),
    [connecting, setConnecting] = useState(false),
    [connection, setConnection] = useState({
      code: '',
      players: 0,
      owner: false,
    }),
    [signalText, setSignalText] = useState('');
  const [error, setError] = useState(''),
    [scores, setScores] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [installMessage, setInstallMessage] = useState('');
  const api = useRef({
    connect: async (
      _url: string,
      _code: string,
      _team: string,
      _size: number,
      _fillBots: boolean,
      _mode: 'competitive' | 'tdm',
    ) => {},
    signal: (_signal: string) => {},
    weapon: (_weapon: string) => {},
    start: (
      _team: string,
      _size: number,
      _classId: string,
      _mode: 'competitive' | 'tdm',
    ) => {},
    resume: () => {},
    pause: () => {},
    move: (_x: number, _y: number) => {},
    look: (_x: number, _y: number) => {},
    attack: () => {},
    attackHold: (_held: boolean) => {},
    attackCancel: () => {},
    attackAim: (_x: number, _y: number) => {},
    dodge: () => {},
    jump: () => {},
    guard: (_v: boolean) => {},
    sprint: (_v: boolean) => {},
    mount: () => {},
    mode: (_v: boolean) => {},
  });
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const finishInstall = () => {
      setInstallPrompt(null);
      setInstallMessage(
        'Oyun telefona eklendi. Kısayoldan tam ekran açabilirsin.',
      );
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', finishInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', finishInstall);
    };
  }, []);
  const installOrFullscreen = async () => {
    setInstallMessage('');
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setInstallMessage(
          'Tam ekran açıldı. Kalıcı kısayol için tarayıcı menüsünden “Ana ekrana ekle”yi seç.',
        );
      }
    } catch {
      setInstallMessage(
        'Kısayol için tarayıcı menüsünü açıp “Ana ekrana ekle”yi seç. Kısayoldan açıldığında oyun tam ekran çalışır.',
      );
    }
  };
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
    let mobile =
      navigator.maxTouchPoints > 0 ||
      matchMedia('(any-pointer: coarse)').matches;
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
    for (const o of DEFENSE_STRUCTURES)
      box(scene, o.w, o.h, o.d, o.x, o.h / 2, o.z, o.color);
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
    const models = new Map<string, ReturnType<typeof makeWarrior>>();
    const horseModels = new Map<number, ReturnType<typeof makeHorse>>();
    const arrowModels = new Map<number, THREE.Mesh>();
    const sparks: { mesh: THREE.Mesh; v: THREE.Vector3; left: number }[] = [];
    let hitPulse = 0,
      hitLabel = '',
      effectTime = 0;
    const impact = (x: number, z: number, blocked: boolean) => {
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.035, 0),
          new THREE.MeshBasicMaterial({
            color: blocked ? 0xbdeaff : 0xffd194,
            transparent: true,
          }),
        );
        mesh.position.set(x, 1.3, z);
        scene.add(mesh);
        sparks.push({
          mesh,
          v: new THREE.Vector3(
            Math.sin(i * 2.4) * 2,
            1 + (i % 3),
            Math.cos(i * 2.4) * 2,
          ),
          left: 0.35,
        });
      }
    };
    const addActor = (a: Actor) => {
      const model = makeWarrior(
        a.team === 'blue' ? 0x316f8b : 0xa94f40,
        a.id === playerId,
        material,
      );
      models.set(a.id, model);
      scene.add(model.group);
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
    const orbitOffset = new THREE.Vector3();
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
    let mouseHeld = false;
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
        (m.trail.material as THREE.Material).dispose();
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
        if (e.type === 'hit' || e.type === 'block' || e.type === 'parry') {
          const a = match.actors.find((a) => a.id === e.id);
          if (a) impact(a.x, a.z, e.type !== 'hit');
          if (e.type === 'parry' && e.id === playerId) {
            hitLabel = 'SAVUŞTURDUN · KARŞILIK VER';
            effectTime = 0.8;
            beep(900);
          }
          if (e.by === playerId) {
            hitPulse = 0.22;
            hitLabel =
              e.type === 'parry'
                ? 'SALDIRIN SAVUŞTURULDU'
                : e.type === 'block'
                  ? 'BLOK'
                  : 'İSABET';
            effectTime = 0.5;
            beep(e.type === 'block' ? 700 : 150);
          }
        }
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
      input = { ...emptyInput(), yaw: input.yaw, weapon: input.weapon };
      mouseHeld = false;
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
    const start = (
      team: string,
      size: number,
      classId = 'knight',
      mode: 'competitive' | 'tdm' = 'competitive',
    ) => {
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
      match = createMatch({ teamSize: size, mode });
      playerId = 'local';
      const p = joinMatch(match, playerId, team, 'Sen', classId);
      match.actors.forEach(addActor);
      release();
      input.yaw = p.heading;
      input.weapon = p.weapon;
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
      fillRoomWithBots: boolean,
      mode: 'competitive' | 'tdm',
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
          code
            ? { team }
            : { team, teamSize: size, fillBots: fillRoomWithBots, mode },
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
        input.weapon =
          match!.actors.find((actor) => actor.id === playerId)?.weapon ??
          'sword';
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
      mount: () => {
        if (!paused) input.mount = true;
      },
      weapon: (w) => {
        input.weapon = w;
      },
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
        pitch = THREE.MathUtils.clamp(pitch + y * 0.004, -0.4, 1.25);
      },
      attack: () => {
        if (!paused) input.attack = true;
      },
      attackHold: (held) => {
        input.attackHeld = !paused && held;
      },
      attackCancel: () => {
        input.cancelAttack = true;
        input.attackHeld = false;
        input.attack = false;
      },
      attackAim: (x, y) => {
        if (!paused) input.attackDirection = attackDirection(x, y);
      },
      dodge: () => {
        if (!paused) input.dodge = true;
      },
      jump: () => {
        if (!paused) input.jump = true;
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
          'KeyQ',
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
      if (e.code === 'KeyE' && !e.repeat) input.mount = true;
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code))
        input.weapon = ['sword', 'spear', 'bow'][Number(e.code.slice(-1)) - 1];
      if (e.code === 'Space' && !e.repeat) input.jump = true;
      if (e.code === 'KeyQ' && !e.repeat) input.dodge = true;
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const mouse = (e: MouseEvent) => {
      if (
        (document.pointerLockElement !== renderer.domElement && !mouseHeld) ||
        paused
      )
        return;
      input.yaw -= e.movementX * 0.003;
      if (Math.hypot(e.movementX, e.movementY) > 3)
        input.attackDirection = attackDirection(e.movementX, e.movementY);
      pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.003, -0.4, 1.25);
    };
    const attack = (e: MouseEvent) => {
      if (paused || !match) return;
      mouseHeld = true;
      if (e.button === 0) {
        input.attack = true;
        input.attackHeld = true;
      }
      if (e.button === 2) input.guard = true;
    };
    const lift = (e: MouseEvent) => {
      mouseHeld = false;
      if (e.button === 0) input.attackHeld = false;
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
            jump: !paused && input.jump,
          };
          input.attack = false;
          input.cancelAttack = false;
          input.dodge = false;
          input.jump = false;
          input.mount = false;
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
        if (!online && !paused && match.phase !== 'finished') {
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
            input.cancelAttack = false;
            input.dodge = false;
            input.jump = false;
            input.mount = false;
            accumulator -= 1 / 60;
            for (const e of match.events) {
              if (e.type === 'swing' && e.id === playerId) beep(280);
              if (
                e.type === 'hit' ||
                e.type === 'block' ||
                e.type === 'parry'
              ) {
                const a = match.actors.find((a) => a.id === e.id);
                if (a) impact(a.x, a.z, e.type !== 'hit');
                if (e.type === 'parry' && e.id === playerId) {
                  hitLabel = 'SAVUŞTURDUN · KARŞILIK VER';
                  effectTime = 0.8;
                  beep(900);
                }
                if (e.by === playerId) {
                  hitPulse = 0.22;
                  hitLabel =
                    e.type === 'parry'
                      ? 'SALDIRIN SAVUŞTURULDU'
                      : e.type === 'block'
                        ? 'BLOK'
                        : String(e.damage) + ' HASAR';
                  effectTime = 0.5;
                }
              }
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
            (model.trail.material as THREE.Material).dispose();
            models.delete(id);
          }
        for (const a of match.actors) {
          if (!models.has(a.id)) addActor(a);
          const m = models.get(a.id)!;
          const visualAlpha = 1 - Math.exp(-18 * dt);
          if (
            !m.group.userData.positionReady ||
            Math.hypot(m.group.position.x - a.x, m.group.position.z - a.z) > 8
          ) {
            m.group.position.set(
              a.x,
              (a.elevation ?? 0) + (a.mounted ? 1.2 : (a.jumpHeight ?? 0)),
              a.z,
            );
            m.group.userData.positionReady = true;
          } else {
            m.group.position.x += (a.x - m.group.position.x) * visualAlpha;
            m.group.position.z += (a.z - m.group.position.z) * visualAlpha;
            m.group.position.y +=
              (((a.elevation ?? 0) +
                  (a.mounted ? 1.2 : (a.jumpHeight ?? 0))) -
                m.group.position.y) *
              visualAlpha;
          }
          m.sword.visible = a.weapon === 'sword';
          m.spear.visible = a.weapon === 'spear';
          m.bow.visible = a.weapon === 'bow';
          m.shield.visible = a.weapon === 'sword';
          const duration = WEAPONS[a.weapon as keyof typeof WEAPONS].duration;
          const attackPhase = Math.max(0, a.attackTime / duration);
          (m.trail.material as THREE.MeshBasicMaterial).opacity =
            a.weapon === 'sword' && a.attackTime > 0.16 && a.attackTime < 0.38
              ? 0.55
              : 0;
          m.trail.rotation.z = attackPhase * 3;
          m.group.rotation.set(
            0,
            a.heading,
            a.health === 0 ? Math.min(1.4, (4 - a.respawn) * 3) : 0,
          );
          m.bar.scale.x = Math.max(0.001, a.health / a.maxHealth);
          m.halo.visible = a.health > 0;
          m.halo.scale.setScalar(
            a.protection > 0 ? 1.2 + Math.sin(now * 0.006) * 0.1 : 1,
          );
          const weight = a.health > 0 ? Math.min(a.speed / 3.3, 1) : 0;
          for (let i = 0; i < 2; i++) {
            m.legs[i].rotation.x = a.mounted
              ? -0.9
              : Math.sin(a.gait + i * Math.PI) * 0.65 * weight;
            m.knees[i].rotation.x = a.mounted
              ? 1.2
              : Math.max(0, -Math.sin(a.gait + i * Math.PI)) * 0.9 * weight;
            m.arms[i].rotation.x =
              -Math.sin(a.gait + i * Math.PI) * 0.3 * weight;
          }
          m.elbows.forEach((elbow) => elbow.rotation.set(0, 0, 0));
          m.arms[1].rotation.order = 'YXZ';
          m.arms[1].rotation.y = 0;
          m.arms[1].rotation.z = 0;
          m.arms[1].position.z = 0;
          if (
            a.weapon === 'spear' ||
            (a.weapon === 'sword' && a.attackTime >= 0)
          ) {
            const pose = meleePose(a.weapon, a.attackTime, a.attackDirection);
            m.arms[1].rotation.set(
              pose.x,
              pose.y + (a.mounted ? a.attackOffset : 0),
              pose.z,
              'YXZ',
            );
            m.arms[1].position.z = -pose.thrust;
          }
          if (a.weapon === 'spear' && a.blocking) {
            m.arms[1].rotation.set(Math.PI / 2, 0.9, 0, 'YXZ');
          }
          if (a.weapon === 'bow') {
            m.arms[1].rotation.set(1.15, a.attackTime >= 0 ? -0.6 : 0, 0);
          }
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
          if (a.weapon === 'bow') {
            m.arms[0].rotation.set(1.5, -0.55, 0, 'YXZ');
            m.bow.quaternion
              .copy(m.arms[0].quaternion.clone().invert())
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(0, 1, 0),
                  Math.PI / 2,
                ),
              );
            const draw =
                a.bowManual && a.attackTime >= 0
                  ? a.bowCharge * (a.hitChecked ? bowDraw(a.attackTime) : 1)
                  : bowDraw(a.attackTime),
              nock = new THREE.Vector3(-0.24 - 0.36 * draw, 0, 0);
            m.bowStrings.forEach((string, i) => {
              const end = new THREE.Vector3(-0.24, i === 0 ? -0.6 : 0.6, 0),
                delta = nock.clone().sub(end);
              string.position.copy(end).add(nock).multiplyScalar(0.5);
              string.scale.y = delta.length();
              string.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                delta.normalize(),
              );
            });
            m.nockedArrow.visible = a.attackTime < 0 || a.attackTime < 0.48;
            m.nockedArrow.position
              .copy(nock)
              .add(new THREE.Vector3(0.425, 0, 0));
            m.group.updateMatrixWorld(true);
            const hand = m.group.worldToLocal(m.bow.localToWorld(nock.clone()));
            const shoulder = m.arms[1].position,
              dir = hand.clone().sub(shoulder),
              distance = Math.min(0.689, Math.max(0.091, dir.length()));
            dir.normalize();
            const along =
                (0.39 * 0.39 - 0.3 * 0.3 + distance * distance) /
                (2 * distance),
              height = Math.sqrt(Math.max(0, 0.39 * 0.39 - along * along));
            const bend = new THREE.Vector3(0, 1, 0)
              .addScaledVector(dir, -dir.y)
              .normalize();
            const elbow = dir
              .clone()
              .multiplyScalar(along)
              .addScaledVector(bend, height);
            m.arms[1].quaternion.setFromUnitVectors(
              new THREE.Vector3(0, -1, 0),
              elbow.clone().normalize(),
            );
            const forearm = dir
              .clone()
              .multiplyScalar(distance)
              .sub(elbow)
              .normalize()
              .applyQuaternion(m.arms[1].quaternion.clone().invert());
            m.elbows[1].quaternion.setFromUnitVectors(
              new THREE.Vector3(0, -1, 0),
              forearm,
            );
          }
          if (a.flash > 0)
            m.group.rotation.x = -Math.sin(a.flash * 35) * a.flash * 0.2;
          else m.group.rotation.x = 0;
        }
        for (const h of match.horses) {
          if (!horseModels.has(h.id)) {
            const model = makeHorse(material);
            horseModels.set(h.id, model);
            scene.add(model.group);
          }
          const model = horseModels.get(h.id)!;
          model.group.position.set(h.x, 0, h.z);
          model.group.rotation.y = h.heading;
          const rider = match.actors.find((a) => a.id === h.rider);
          if (rider) {
            const visual = models.get(rider.id)!.group.position;
            model.group.position.set(visual.x, 0, visual.z);
          }
          model.legs.forEach(
            (leg, i) =>
              (leg.rotation.x = rider
                ? Math.sin(rider.gait + (i % 2) * Math.PI) *
                  0.6 *
                  Math.min(Math.abs(rider.speed) / 5, 1)
                : 0),
          );
        }
        for (const [id, model] of horseModels)
          if (!match.horses.some((h) => h.id === id)) {
            scene.remove(model.group);
            model.group.traverse((o) => {
              if (o instanceof THREE.Mesh) o.geometry.dispose();
            });
            horseModels.delete(id);
          }
        for (const p of match.projectiles) {
          if (!arrowModels.has(p.id)) {
            const mesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.018, 0.018, 0.85, 5),
              material(0xe8cc89),
            );
            mesh.geometry.rotateX(Math.PI / 2);
            scene.add(mesh);
            arrowModels.set(p.id, mesh);
          }
          const mesh = arrowModels.get(p.id)!;
          mesh.position.set(p.x, p.y ?? 1.45, p.z);
          mesh.rotation.y = Math.atan2(p.vx, p.vz);
        }
        for (const [id, mesh] of arrowModels)
          if (!match.projectiles.some((p) => p.id === id)) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            arrowModels.delete(id);
          }
        if (
          match.phase === 'finished' &&
          document.pointerLockElement === renderer.domElement
        )
          document.exitPointerLock();
        const me = match.actors.find((a) => a.id === playerId)!;
        const observed =
          me.health <= 0 && match.rules.mode === 'competitive'
            ? match.actors.find((a) => a.team === me.team && a.health > 0) ??
              match.actors.find((a) => a.health > 0) ??
              me
            : me;
        const visualPlayer = models.get(observed.id)!.group.position;
        const aimingBow = observed === me && me.weapon === 'bow' && me.attackTime >= 0;
        const shoulder = aimingBow ? 0.85 : 0;
        const target = new THREE.Vector3(
            visualPlayer.x + Math.cos(input.yaw) * shoulder,
            visualPlayer.y + (aimingBow ? 1.65 : 1.5),
            visualPlayer.z - Math.sin(input.yaw) * shoulder,
          ),
          distance = aimingBow ? 4.5 : 6.5;
        const desired = target
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(input.yaw) * distance * Math.cos(pitch),
              Math.sin(pitch) * distance,
              Math.cos(input.yaw) * distance * Math.cos(pitch),
            ),
          );
        const requestedOffset = desired.clone().sub(target);
        if (!cameraReady) orbitOffset.copy(requestedOffset);
        else orbitOffset.lerp(requestedOffset, 1 - Math.exp(-18 * dt));
        desired.copy(target).add(orbitOffset);
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
        camera.position.copy(desired);
        cameraReady = true;
        camera.lookAt(target);
        if (now - lastHud > 100) {
          lastHud = now;
          setHud({
            health: me.health,
            maxHealth: me.maxHealth,
            bowCharge:
              me.weapon === 'bow' && me.attackTime >= 0 && !me.hitChecked
                ? me.bowCharge
                : 0,
            bowSpread: bowSpread(
              me.weapon === 'bow' && me.attackTime >= 0 && !me.hitChecked
                ? me.bowCharge
                : 0,
              Math.hypot(me.contactVx || 0, me.contactVz || 0),
              me.mounted,
            ),
            maxStamina: me.maxStamina,
            mounted: me.mounted,
            near: match.horses.some(
              (h) => !h.rider && Math.hypot(h.x - me.x, h.z - me.z) < 3.5,
            ),
            weapon: me.weapon,
            stamina: Math.round(me.stamina),
            blue:
              match.rules.mode === 'competitive'
                ? match.roundScore.blue
                : match.score.blue,
            red:
              match.rules.mode === 'competitive'
                ? match.roundScore.red
                : match.score.red,
            remaining: Math.ceil(match.rules.duration - match.elapsed),
            respawn: Math.ceil(me.respawn),
            roundBreak: Math.ceil(match.roundBreak || 0),
            protection: Math.ceil(me.protection),
            phase: match.phase,
            mode: match.rules.mode,
            round: match.round,
            spectating: observed === me ? '' : observed.name,
            paused,
            hurt,
            message:
              effectTime > 0
                ? hitLabel
                : match.elapsed < messageUntil
                  ? message
                  : '',
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
      hitPulse = Math.max(0, hitPulse - dt);
      effectTime = Math.max(0, effectTime - dt);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.left -= dt;
        p.mesh.position.addScaledVector(p.v, dt);
        p.v.y -= 8 * dt;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          p.left / 0.35,
        );
        if (p.left <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          sparks.splice(i, 1);
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
      for (const m of models.values()) {
        (m.halo.material as THREE.Material).dispose();
        (m.trail.material as THREE.Material).dispose();
      }
      materials.forEach((m) => m.dispose());
      for (const p of sparks) (p.mesh.material as THREE.Material).dispose();
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
            <small>
              {hud.mode === 'competitive'
                ? `RAUNT ${hud.round} · HEDEF 7`
                : 'HEDEF 15'}
            </small>
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
            Oda ayarını seç. Rakibini devir, takımına skor kazandır. 15 skor
            veya 5 dakika.
          </p>
          {touch && (
            <>
              <button
                className="mobile-install"
                type="button"
                onClick={() => void installOrFullscreen()}
              >
                <span aria-hidden="true">⛶</span>
                Telefona ekle / tam ekran
              </button>
              {installMessage && (
                <output className="install-message">{installMessage}</output>
              )}
            </>
          )}
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
            Oyun kuralı
            <select
              value={gameMode}
              onChange={(e) =>
                setGameMode(e.target.value as 'competitive' | 'tdm')
              }
            >
              <option value="competitive">Rekabetçi raund</option>
              <option value="tdm">Team Deathmatch</option>
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
              {!roomCode && (
                <label>
                  Oda dolgusu
                  <select
                    value={fillBots ? 'bots' : 'players'}
                    onChange={(e) => setFillBots(e.target.value === 'bots')}
                  >
                    <option value="bots">Botlarla doldur</option>
                    <option value="players">Yalnız gerçek oyuncular</option>
                  </select>
                </label>
              )}
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
                ? void api.current.connect(
                    serverUrl,
                    roomCode,
                    team,
                    size,
                    fillBots,
                    gameMode,
                  )
                : api.current.start(team, size, 'knight', gameMode)
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
          {error && <p role="alert">{error}</p>}
        </section>
      )}
      {started && !finished && (
        <>
          {hud.weapon === 'bow' ? (
            <div
              className="bow-reticle"
              aria-label={`Yay nişangâhı, geriş yüzde ${Math.round(hud.bowCharge * 100)}`}
            >
              <span
                className="bow-reticle-ring"
                style={{
                  width: 20 + hud.bowSpread * 450,
                  height: 20 + hud.bowSpread * 450,
                  borderColor: hud.bowCharge >= 0.95 ? '#aee9be' : '#ffe0a3',
                }}
              />
              <span className="bow-reticle-center">+</span>
              <small>
                {Math.round(hud.bowCharge * 100)}% ·{' '}
                {hud.bowSpread < 0.025
                  ? 'SABİT'
                  : hud.bowSpread < 0.07
                    ? 'DAR'
                    : 'GENİŞ'}
              </small>
            </div>
          ) : (
            <div className="crosshair">·</div>
          )}
          <section className="battle-vitals">
            <span>{team === 'blue' ? 'MAVİ' : 'KIZIL'} TAKIM · SEN</span>
            <label>
              CAN {hud.health}
              <meter min="0" max={hud.maxHealth} value={hud.health} />
            </label>
            <label>
              DAYANIKLILIK {hud.stamina}
              <meter min="0" max={hud.maxStamina} value={hud.stamina} />
            </label>
            {hud.protection > 0 && hud.health > 0 && (
              <small>Doğma koruması · {hud.protection} sn</small>
            )}
            {hud.weapon === 'bow' && (
              <label>
                YAY GERİŞİ {Math.round(hud.bowCharge * 100)}%
                <meter min="0" max="1" value={hud.bowCharge} />
              </label>
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
              WASD hareket · Sol tık saldırı · Sağ tık savunma · Boşluk zıpla ·
              Q kaçın · ESC duraklat
            </div>
          )}
        </>
      )}
      <div className="damage-flash" style={{ opacity: hud.hurt / 0.5 }} />
      {touch && hud.mode === 'competitive' && hud.health === 0 && !hud.paused && !finished && (
        <div
          className="spectator-look"
          aria-label="İzleyici kamerası"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            spectatorPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const previous = spectatorPointer.current;
            if (previous?.id !== event.pointerId) return;
            api.current.look(event.clientX - previous.x, event.clientY - previous.y);
            spectatorPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerUp={() => (spectatorPointer.current = null)}
          onPointerCancel={() => (spectatorPointer.current = null)}
        />
      )}
      {started && hud.health === 0 && !finished && !hud.paused && (
        <div className={`battle-respawn ${hud.mode === 'competitive' ? 'spectator-status' : ''}`} role="status">
          <strong>Öldün</strong>
          {hud.spectating && <small>{hud.spectating} izleniyor</small>}
          <span>
            {hud.mode === 'competitive'
              ? hud.phase === 'round-break'
                ? `${hud.roundBreak} saniye sonra yeni raund`
                : 'Takımının raundu tamamlamasını bekle'
              : `${hud.respawn} saniyede yeniden doğacaksın`}
          </span>
        </div>
      )}
      {touch && hud.phase === 'playing' && !hud.paused && hud.health > 0 && (
        <MobileControls
          input={api.current}
          mounted={hud.mounted}
          near={hud.near}
          showMount={true}
          attackLabel={WEAPONS[hud.weapon as keyof typeof WEAPONS].label}
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
      {started && !finished && !hud.paused && hud.health > 0 && (
        <div className="weapon-select">
          {Object.entries(WEAPONS).map(([id, w], i) => (
            <button
              key={id}
              aria-pressed={hud.weapon === id}
              onClick={() => api.current.weapon(id)}
            >
              {i + 1} · {w.label}
            </button>
          ))}
          {!touch && (
            <button
              disabled={!hud.mounted && !hud.near}
              onClick={() => api.current.mount()}
            >
              E · {hud.mounted ? 'Attan in' : 'Ata bin'}
            </button>
          )}
        </div>
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
              api.current.start(team, size, 'knight', gameMode);
            }}
          >
            {connection.code && !connection.owner
              ? 'Yeni maçı oda sahibi başlatır'
              : 'Yeni maç'}
          </button>
          <button
            className="secondary"
            onClick={() => window.location.assign('/battle')}
          >
            Ana menüye dön
          </button>
        </section>
      )}
    </main>
  );
}
