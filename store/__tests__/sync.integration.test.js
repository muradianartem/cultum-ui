// A sync round through the real stack: AuthProvider's bearer, api/client,
// api/garden, GardenProvider's round and the reducer's rebase, and
// store/persist on the in-memory filesystem. Only the network and SecureStore
// are faked (test/support/integration.js).
//
// store/__tests__/sync.test.js and syncRace.test.js drive syncGarden with a
// fake `api` object and a hand-built state; these check that the pieces still
// agree once GardenProvider is the one calling them.

import { act } from 'react-test-renderer';
import {
  advance,
  authStore,
  cleanup,
  createServer,
  deferred,
  json,
  renderGarden,
  savedGarden,
  session,
  writeGarden,
} from '../../test/support/integration';
import { seedGarden } from '../testing';
import { enqueue } from '../outbox';
import { loadState } from '../persist';

jest.mock('../../lib/authStorage', () => require('../../test/support/integration').fakeAuthStorage);
jest.mock('../../lib/net', () => require('../../test/support/integration').net);

const NOW = new Date(2026, 8, 21, 12, 0, 0);
// Past GardenProvider's sync (2000) and save (400) debounces.
const SETTLE_MS = 2500;

const plantDto = (id, nickname) => ({
  id,
  species_key: 'monstera-deliciosa',
  nickname,
  room_id: null,
  acquired_at: '2026-08-01',
  care: null,
  reminders: [],
});

// A one-user backend that keeps its own copy of the garden, so a PATCH or a
// POST is visible to the next GET.
let server;
let remote;
function serve() {
  remote = [];
  server = createServer();
  global.fetch = server.fetch;
  server.route('GET', '/users/me/rooms', () => []);
  server.route('GET', '/users/me/plants', () => remote.map((p) => ({ ...p })));
  server.route('POST', '/users/me/plants', (req) => {
    const dto = plantDto(`SP${remote.length + 1}`, req.body.nickname);
    remote.push(dto);
    return dto;
  });
  server.route('PATCH', '/users/me/plants/', (req) => {
    const id = decodeURIComponent(req.path.split('/').pop());
    const dto = remote.find((p) => p.id === id);
    Object.assign(dto, { nickname: req.body.nickname ?? dto.nickname });
    return dto;
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  authStore.tokens = session('T1', 'r1');
  serve();
});

afterEach(async () => {
  cleanup();
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Guards 02: a round used to replace the document with the one it started
// from, plus the server's answer — so a rename made while the pull was in
// flight was overwritten by the server's old name, and its push lost.
test('a rename made while the pull is in flight survives it, and is pushed next round', async () => {
  const doc = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', room: 'Kitchen' }] });
  const penny = doc.plants[0];
  writeGarden({ ...doc, plants: [{ ...penny, serverId: 'SP1', roomId: null }], rooms: [] });
  remote.push(plantDto('SP1', 'Penny'));

  const pull = deferred();
  server.route('GET', '/users/me/plants', () => pull.promise);

  const view = await renderGarden();
  await advance(SETTLE_MS); // the round is out, waiting on the pull
  expect(server.requests('GET', '/users/me/plants')).toHaveLength(1);

  act(() => view.garden.renamePlant(penny.id, 'Rosie'));
  pull.resolve([plantDto('SP1', 'Penny')]);
  await advance(0);

  expect(view.garden.plants.find((p) => p.id === penny.id).nickname).toBe('Rosie');

  // The next round carries the rename to the server.
  server.route('GET', '/users/me/plants', () => remote.map((p) => ({ ...p })));
  await advance(SETTLE_MS);
  const patches = server.requests('PATCH', '/users/me/plants/SP1');
  expect(patches).toHaveLength(1);
  expect(patches[0].body).toMatchObject({ nickname: 'Rosie' });
  expect(view.garden.plants.find((p) => p.id === penny.id).nickname).toBe('Rosie');
});

// Guards 03: a pull that failed after a successful push used to throw the
// whole round away, new server ids included — so the next round POSTed the
// same plant again and the server got a duplicate.
test('push succeeds, pull fails: the next round sends no duplicate create', async () => {
  const doc = seedGarden({ now: NOW, plants: [{ nickname: 'Figgy', room: 'Kitchen' }] });
  const figgy = doc.plants[0];
  writeGarden({
    ...doc,
    rooms: [],
    plants: [{ ...figgy, roomId: null }],
    outbox: enqueue([], 'plant.create', figgy.id),
  });
  let pulls = 0;
  server.route('GET', '/users/me/plants', () => {
    pulls += 1;
    return pulls === 1 ? json({ detail: 'upstream timeout' }, 503) : remote.map((p) => ({ ...p }));
  });

  const view = await renderGarden();
  await advance(SETTLE_MS);
  expect(server.requests('POST', '/users/me/plants')).toHaveLength(1);
  expect(pulls).toBe(1);
  expect(view.garden.plants[0].serverId).toBe('SP1');

  await act(async () => {
    await view.garden.sync();
  });
  await advance(SETTLE_MS);

  expect(pulls).toBeGreaterThanOrEqual(2);
  expect(server.requests('POST', '/users/me/plants')).toHaveLength(1);
  expect(remote).toHaveLength(1);
  expect(view.garden.plants).toHaveLength(1);
});

// Guards 03 on disk: the ids a round earned have to reach the saved document,
// or a relaunch before the next successful pull re-creates everything.
test('the document saved after a round reloads with its server ids', async () => {
  const doc = seedGarden({ now: NOW, plants: [{ nickname: 'Figgy', room: 'Kitchen' }] });
  const figgy = doc.plants[0];
  writeGarden({
    ...doc,
    rooms: [],
    plants: [{ ...figgy, roomId: null }],
    outbox: enqueue([], 'plant.create', figgy.id),
  });
  server.route('GET', '/users/me/plants', () => json({ detail: 'upstream timeout' }, 503));

  const view = await renderGarden();
  await advance(SETTLE_MS);
  await advance(SETTLE_MS); // the save debounce, after the round landed
  view.unmount();

  expect(savedGarden().outbox).toEqual([]);
  const reloaded = await loadState();
  expect(reloaded.plants.map((p) => [p.id, p.serverId])).toEqual([[figgy.id, 'SP1']]);

  // ...and a relaunch on that document has nothing left to create.
  server.route('GET', '/users/me/plants', () => remote.map((p) => ({ ...p })));
  const again = await renderGarden();
  await advance(SETTLE_MS);
  expect(again.garden.plants.map((p) => p.serverId)).toEqual(['SP1']);
  expect(server.requests('POST', '/users/me/plants')).toHaveLength(1);
});
