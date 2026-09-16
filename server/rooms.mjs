import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  createMatch,
  joinMatch,
  leaveMatch,
  stepMatch,
} from '../lib/match.mjs';
import { parseMovementMessage } from '../lib/player-motion.mjs';

export function parseCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Geçersiz komut');
  const {
    attack = false,
    attackHeld,
    pitch = 0,
    cancelAttack = false,
    attackDirection = 'right',
    guard = false,
    dodge = false,
    jump = false,
    mount = false,
    weapon = 'sword',
    ...move
  } = value;
  if (!['sword', 'spear', 'bow'].includes(weapon))
    throw Error('Geçersiz silah');
  if (attackHeld !== undefined && typeof attackHeld !== 'boolean') throw Error('Geçersiz komut');
  if (!Number.isFinite(pitch) || pitch < -0.4 || pitch > 1.25) throw Error('Geçersiz komut');
  if (!['right', 'left', 'overhead', 'thrust'].includes(attackDirection)) throw Error('Geçersiz saldırı yönü');
  if ([attack, cancelAttack, guard, dodge, jump, mount].some((v) => typeof v !== 'boolean'))
    throw Error('Geçersiz komut');
  return { ...parseMovementMessage(move), attack, attackHeld, pitch, cancelAttack, attackDirection, guard, dodge, jump, mount, weapon };
}
export function createRoomServer({
  origins = ['http://localhost:3000', 'http://127.0.0.1:3000'],
  maxRooms = 20,
  now = () => performance.now(),
} = {}) {
  const rooms = new Map();
  const send = (res, status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(data));
  };
  const attach = (room, team) => {
    const token = randomBytes(24).toString('base64url'),
      id = randomBytes(12).toString('hex');
    joinMatch(room.match, id, team, `Oyuncu ${room.nextPlayer++}`);
    room.clients.set(token, {
      id,
      lastSeen: now(),
      lastInput: -Infinity,
      sequence: -1,
      lastSignal: -Infinity,
      input: {},
      budget: 60,
      budgetAt: now(),
    });
    return { token, playerId: id };
  };
  const snapshot = (room, id) => ({
    match: room.match,
    players: room.clients.size,
    owner: room.clients.get(room.owner)?.id === id,
    events: room.events.filter(
      (e) =>
        e.type !== 'signal' ||
        e.signal === 'gg' ||
        e.team === room.match.actors.find((a) => a.id === id)?.team,
    ),
  });
  const event = (room, value) => {
    room.events.push({ ...value, serial: ++room.serial });
    if (room.events.length > 32) room.events.shift();
  };
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      send(res, 403, { error: 'Bu adres sunucuda izinli değil' });
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    let body = {};
    try {
      if (req.method === 'POST') {
        let bytes = 0,
          chunks = [];
        for await (const part of req) {
          bytes += part.length;
          if (bytes > 4096) {
            send(res, 413, { error: 'Komut çok büyük' });
            return;
          }
          chunks.push(part);
        }
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        if (!body || typeof body !== 'object' || Array.isArray(body))
          throw Error('Geçersiz istek');
      }
      const path = new URL(req.url, 'http://room.local').pathname;
      if (path === '/health' && req.method === 'GET') {
        send(res, 200, { ok: true, protocol: 1 });
        return;
      }
      if (path === '/rooms/play' && req.method === 'POST') {
        if (!['competitive', 'tdm', 'ctf'].includes(body.mode) || ![2, 5].includes(body.teamSize))
          throw Error('Oyun seçimi geçersiz');
        const room = [...rooms.values()].find((candidate) =>
          !candidate.password && candidate.match.phase !== 'finished' &&
          candidate.match.rules.mode === body.mode &&
          candidate.match.rules.teamSize === body.teamSize &&
          candidate.clients.size < body.teamSize * 2,
        );
        if (room) {
          const count = (team) => room.match.actors.filter((a) => !a.bot && a.team === team).length;
          const team = count('blue') <= count('red') ? 'blue' : 'red';
          const auth = attach(room, team);
          send(res, 201, { code: room.code, ...auth, ...snapshot(room, auth.playerId) });
          return;
        }
        body.team = 'blue';
        body.fillBots = true;
      }
      if ((path === '/rooms' || path === '/rooms/play') && req.method === 'POST') {
        if (rooms.size >= maxRooms) {
          send(res, 503, { error: 'Sunucu dolu' });
          return;
        }
        if (
          !['blue', 'red'].includes(body.team) ||
          ![2, 5].includes(body.teamSize) ||
          (body.mode !== undefined &&
            !['tdm', 'competitive', 'ctf'].includes(body.mode)) ||
          (body.fillBots !== undefined && typeof body.fillBots !== 'boolean')
        )
          throw Error('Takım seçimi geçersiz');
        let code;
        do {
          code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
        } while (rooms.has(code));
        const room = {
          code,
          match: createMatch({
            teamSize: body.teamSize,
            fillBots: body.fillBots !== false,
            mode: body.mode,
          }),
          clients: new Map(),
          nextPlayer: 1,
          emptySince: now(),
          created: now(),
          events: [],
          serial: 0,
        };
        const auth = attach(room, body.team);
        room.owner = auth.token;
        rooms.set(code, room);
        send(res, 201, { code, ...auth, ...snapshot(room, auth.playerId) });
        return;
      }
      const route = path.match(
        /^\/rooms\/([A-F0-9]{6})(?:\/(join|input|leave|restart|signal))?$/,
      );
      if (!route) {
        send(res, 404, { error: 'Adres bulunamadı' });
        return;
      }
      const room = rooms.get(route[1]);
      if (!room) {
        send(res, 404, { error: 'Oda bulunamadı veya süresi doldu' });
        return;
      }
      if (route[2] === 'join' && req.method === 'POST') {
        if (!['blue', 'red'].includes(body.team))
          throw Error('Takım seçimi geçersiz');
        if (room.match.phase === 'finished')
          throw Error('Maç bitti; oda sahibi yeni maç başlatmalı');
        const auth = attach(room, body.team);
        send(res, 201, {
          code: room.code,
          ...auth,
          ...snapshot(room, auth.playerId),
        });
        return;
      }
      const token = req.headers.authorization?.replace(/^Bearer /, ''),
        client = room.clients.get(token);
      if (!client) {
        send(res, 401, { error: 'Oturum sona erdi' });
        return;
      }
      client.lastSeen = now();
      client.budget = Math.min(
        60,
        client.budget + (now() - client.budgetAt) * 0.06,
      );
      client.budgetAt = now();
      if (client.budget < 1) {
        send(res, 429, { error: 'Çok sık istek' });
        return;
      }
      client.budget--;
      if (!route[2] && req.method === 'GET') {
        send(res, 200, snapshot(room, client.id));
        return;
      }
      if (route[2] === 'input' && req.method === 'POST') {
        const input = parseCommand(body);
        if (input.sequence <= client.sequence) {
          send(res, 409, { error: 'Eski komut' });
          return;
        }
        client.sequence = input.sequence;
        client.lastInput = now();
        client.input = {
          ...input,
          attack: input.attack || client.input.attack === true,
          cancelAttack: input.cancelAttack || client.input.cancelAttack === true,
          dodge: input.dodge || client.input.dodge === true,
          jump: input.jump || client.input.jump === true,
          mount: input.mount || client.input.mount === true,
        };
        send(res, 200, snapshot(room, client.id));
        return;
      }
      if (route[2] === 'signal' && req.method === 'POST') {
        if (!['together', 'help', 'thanks', 'gg'].includes(body.signal))
          throw Error('Geçersiz çağrı');
        if (now() - client.lastSignal < 3000) {
          send(res, 429, { error: 'Çağrı için biraz bekle' });
          return;
        }
        client.lastSignal = now();
        const actor = room.match.actors.find((a) => a.id === client.id);
        event(room, {
          type: 'signal',
          id: actor.id,
          team: actor.team,
          signal: body.signal,
        });
        send(res, 200, snapshot(room, client.id));
        return;
      }
      if (route[2] === 'leave' && req.method === 'POST') {
        leaveMatch(room.match, client.id);
        room.clients.delete(token);
        if (token === room.owner) room.owner = room.clients.keys().next().value;
        send(res, 200, { left: true });
        return;
      }
      if (route[2] === 'restart' && req.method === 'POST') {
        if (token !== room.owner) {
          send(res, 403, { error: 'Yeni maçı oda sahibi başlatabilir' });
          return;
        }
        const fresh = createMatch({
          teamSize: room.match.rules.teamSize,
          fillBots: room.match.rules.fillBots,
          mode: room.match.rules.mode,
        });
        for (const c of room.clients.values()) {
          const a = room.match.actors.find((a) => a.id === c.id);
          joinMatch(fresh, c.id, a.team, a.name);
          c.input = {};
        }
        room.match = fresh;
        send(res, 200, snapshot(room, client.id));
        return;
      }
      send(res, 405, { error: 'İşlem desteklenmiyor' });
    } catch (error) {
      send(res, 400, {
        error: error instanceof Error ? error.message : 'İstek işlenemedi',
      });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  const tick = () => {
    for (const [code, room] of rooms) {
      for (const [token, c] of room.clients)
        // Keep a seat reserved through a short network interruption. The browser
        // resumes using the same token, so a momentary Wi-Fi handoff does not
        // turn the player into a bot or discard the room session.
        if (now() - c.lastSeen > 30000) {
          leaveMatch(room.match, c.id);
          room.clients.delete(token);
          if (token === room.owner)
            room.owner = room.clients.keys().next().value;
        }
      if (room.clients.size) room.emptySince = now();
      else if (now() - room.emptySince > 120000) {
        rooms.delete(code);
        continue;
      }
      const inputs = {};
      for (const c of room.clients.values()) {
        inputs[c.id] = now() - c.lastInput < 250 ? c.input : {};
        c.input = { ...c.input, attack: false, cancelAttack: false, dodge: false, jump: false, mount: false };
      }
      stepMatch(room.match, inputs, 1 / 30);
      for (const e of room.match.events) event(room, e);
    }
  };
  const timer = setInterval(tick, 1000 / 30);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return { server, rooms, tick };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const host = process.env.GAME_HOST || '127.0.0.1',
    port = Number(process.env.GAME_PORT || 3001);
  const origins = process.env.GAME_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { server } = createRoomServer(origins ? { origins } : {});
  server.listen(port, host, () =>
    console.log(`Room server: http://${host}:${port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
