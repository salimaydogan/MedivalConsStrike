import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomServer, parseCommand } from './rooms.mjs';
const command = (sequence) => ({
  type: 'move',
  sequence,
  forward: 1,
  side: 0,
  yaw: 0,
  sprint: false,
  attack: false,
  guard: false,
  dodge: false,
  jump: false,
});
test('command boundary rejects state injection and invalid action types', () => {
  assert.throws(() => parseCommand({ ...command(1), health: 100 }));
  assert.throws(() => parseCommand({ ...command(1), attack: 'yes' }));
  assert.throws(() => parseCommand({ ...command(1), jump: 'yes' }));
  assert.throws(() => parseCommand({ ...command(1), dt: 10 }));
  assert.equal(parseCommand(command(1)).forward, 1);
});
test('HTTP room: two humans, bot replacement, authority, replay rejection and disconnect', async () => {
  let clock = 0;
  const { server, rooms, tick } = createRoomServer({ now: () => clock });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, token) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    const first = await request('/rooms', { team: 'blue', teamSize: 2 });
    assert.equal(first.status, 201);
    const { code, token, playerId } = first.data;
    const second = await request(`/rooms/${code}/join`, { team: 'red' });
    assert.equal(second.status, 201);
    assert.equal(second.data.match.actors.filter((a) => a.bot).length, 2);
    assert.equal((await request(`/rooms/${code}`)).status, 401);
    assert.equal(
      (await request(`/rooms/${code}/input`, { ...command(1), x: 99 }, token))
        .status,
      400,
    );
    const before = rooms
      .get(code)
      .match.actors.find((a) => a.id === playerId).z;
    assert.equal(
      (await request(`/rooms/${code}/input`, command(1), token)).status,
      200,
    );
    tick();
    assert.ok(
      rooms.get(code).match.actors.find((a) => a.id === playerId).z < before,
    );
    assert.equal(
      (await request(`/rooms/${code}/input`, command(1), token)).status,
      409,
    );
    assert.equal(
      (await request(`/rooms/${code}/restart`, {}, second.data.token)).status,
      403,
    );
    assert.equal(
      (await request(`/rooms/${code}/restart`, {}, token)).status,
      200,
    );
    assert.equal(
      (await request(`/rooms/${code}/leave`, {}, second.data.token)).status,
      200,
    );
    assert.equal(rooms.get(code).match.actors.filter((a) => a.bot).length, 3);
    clock = 8100;
    tick();
    assert.equal(rooms.get(code).clients.size, 0);
    assert.equal(rooms.get(code).match.actors.filter((a) => a.bot).length, 4);
    clock = 130000;
    tick();
    assert.equal(rooms.size, 0);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test('signals are throttled and visible to teammates; good game reaches both teams', async () => {
  let clock = 0;
  const { server } = createRoomServer({ now: () => clock });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (path, body, token) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    const a = (await req('/rooms', { team: 'blue', teamSize: 2 })).data,
      b = (await req(`/rooms/${a.code}/join`, { team: 'red' })).data;
    assert.equal(
      (await req(`/rooms/${a.code}/signal`, { signal: 'help' }, a.token))
        .status,
      200,
    );
    assert.equal(
      (await req(`/rooms/${a.code}/signal`, { signal: 'help' }, a.token))
        .status,
      429,
    );
    assert.equal(
      (await req(`/rooms/${a.code}`, null, b.token)).data.events.filter(
        (e) => e.type === 'signal',
      ).length,
      0,
    );
    clock = 3100;
    await req(`/rooms/${a.code}/signal`, { signal: 'gg' }, a.token);
    assert.equal(
      (await req(`/rooms/${a.code}`, null, b.token)).data.events.filter(
        (e) => e.signal === 'gg',
      ).length,
      1,
    );
    await req(`/rooms/${a.code}/leave`, {}, a.token);
    assert.equal(
      (await req(`/rooms/${a.code}/restart`, {}, b.token)).status,
      200,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
