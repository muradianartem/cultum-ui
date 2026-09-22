// Rebasing a finished sync round onto whatever the user did while it ran.
//
// Each test runs a real round (syncGarden over a fake api) from `base`, applies
// a user action to `base` as if it landed mid-round, and then checks what
// applySyncRound makes of the two.

import { applySyncRound } from '../applySync';
import { reducer } from '../reducer';
import { syncGarden } from '../sync';
import { seedGarden } from '../testing';

const NOW = new Date(2026, 8, 5, 9, 0, 0);
const AT = '2026-09-05T09:00:00.000Z';

const serverPlant = (over = {}) => ({
  id: 'S1',
  species_key: 'monstera-deliciosa',
  nickname: 'Penny',
  room_id: null,
  acquired_at: '2026-08-01',
  reminders: [],
  care: null,
  ...over,
});

const entry = (op, localId, serverId = null) => ({ op, localId, serverId, attempts: 0 });

/** A fake api where the pull finds an empty garden unless told otherwise. */
const fakeApi = (over = {}) => ({
  listRooms: async () => [],
  getGarden: async () => [],
  ...over,
});

const run = (base, api) => syncGarden(base, fakeApi(api), AT);
const act = (state, action) => reducer(state, { now: AT, ...action });

test('renaming a synced plant during the pull keeps the new name and its update', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', serverId: 'S1' }] });
  const plant = base.plants[0];
  const round = await run(base, { getGarden: async () => [serverPlant()] });

  const current = act(base, { type: 'plant/rename', id: plant.id, nickname: 'Fern' });
  const next = applySyncRound(current, round);

  expect(next.plants.map((p) => p.nickname)).toEqual(['Fern']);
  expect(next.outbox).toEqual([entry('plant.update', plant.id, 'S1')]);
});

test('entries the round pushed are retired, and one superseded mid-round stays', async () => {
  const seeded = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', serverId: 'S1' }] });
  const plant = seeded.plants[0];
  const base = act(seeded, { type: 'plant/rename', id: plant.id, nickname: 'Fern' });
  const round = await run(base, {
    updatePlant: async () => ({}),
    getGarden: async () => [serverPlant({ nickname: 'Fern' })],
  });

  expect(applySyncRound(base, round).outbox).toEqual([]);

  // Renamed again while the first PATCH was in flight: `enqueue` made a new
  // entry, and that one hasn't been sent.
  const current = act(base, { type: 'plant/rename', id: plant.id, nickname: 'Figgy' });
  const next = applySyncRound(current, round);
  expect(next.outbox).toEqual([entry('plant.update', plant.id, 'S1')]);
  expect(next.plants[0].nickname).toBe('Figgy');
});

test('a failed pull still adopts the server ids, so the next round sends no create twice', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', reminders: [{ action: 'water' }] }] });
  const [plant] = base.plants;
  const [reminder] = base.reminders;
  base.outbox = [entry('plant.create', plant.id), entry('reminder.create', reminder.id)];
  const addPlant = jest.fn(async () => ({ id: 's-plant' }));
  const api = {
    addPlant,
    createReminder: async () => ({ id: 's-rem' }),
    getGarden: async () => {
      throw Object.assign(new Error('offline'), { code: 'offline' });
    },
  };
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const round = await run(base, api);
  warn.mockRestore();

  const next = applySyncRound(base, round);
  expect(next.plants[0].serverId).toBe('s-plant');
  expect(next.reminders[0].serverId).toBe('s-rem');
  expect(next.outbox).toEqual([]);

  await run(next, { ...api, getGarden: async () => [] });
  expect(addPlant).toHaveBeenCalledTimes(1);
});

test('a plant added during the round survives with its create queued', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', serverId: 'S1' }] });
  const round = await run(base, { getGarden: async () => [serverPlant()] });

  const [added] = seedGarden({ now: NOW, plants: [{ nickname: 'Figgy' }] }).plants;
  const current = act(base, { type: 'plant/add', plant: added });
  const next = applySyncRound(current, round);

  expect(next.plants.map((p) => p.nickname)).toEqual(['Penny', 'Figgy']);
  expect(next.outbox).toEqual([entry('plant.create', added.id)]);
});

test('a synced plant deleted during the pull stays deleted, with its delete queued', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', serverId: 'S1' }] });
  const plant = base.plants[0];
  const round = await run(base, { getGarden: async () => [serverPlant()] });

  const current = act(base, { type: 'plant/delete', id: plant.id });
  const next = applySyncRound(current, round);

  expect(next.plants).toEqual([]);
  expect(next.outbox).toEqual([entry('plant.delete', plant.id, 'S1')]);
});

test('renaming a plant whose create is in flight queues an update with the new name', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny' }] });
  const plant = base.plants[0];
  base.outbox = [entry('plant.create', plant.id)];
  const round = await run(base, {
    addPlant: async () => ({ id: 'S1' }),
    getGarden: async () => [serverPlant({ nickname: 'Penny' })], // the create sent the old name
  });

  // No serverId yet at rename time, so the reducer queued nothing.
  const current = act(base, { type: 'plant/rename', id: plant.id, nickname: 'Fern' });
  expect(current.outbox).toEqual(base.outbox);
  const next = applySyncRound(current, round);

  expect(next.plants).toEqual([expect.objectContaining({ serverId: 'S1', nickname: 'Fern' })]);
  expect(next.outbox).toEqual([entry('plant.update', plant.id, 'S1')]);
});

test('deleting a plant whose create is in flight queues a delete for the orphan', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny' }] });
  const plant = base.plants[0];
  base.outbox = [entry('plant.create', plant.id)];
  const round = await run(base, {
    addPlant: async () => ({ id: 'S1' }),
    getGarden: async () => [serverPlant()],
  });

  // No serverId at delete time, so the reducer just forgot it.
  const current = act(base, { type: 'plant/delete', id: plant.id });
  expect(current.outbox).toEqual([]);
  const next = applySyncRound(current, round);

  expect(next.plants).toEqual([]);
  expect(next.outbox).toEqual([entry('plant.delete', plant.id, 'S1')]);
});

/** A synced plant with one reminder still waiting on its create. */
async function reminderCreateInFlight() {
  const base = seedGarden({
    now: NOW,
    plants: [{ nickname: 'Penny', serverId: 'S1', reminders: [{ action: 'water', intervalDays: 7 }] }],
  });
  const reminder = base.reminders[0];
  base.outbox = [entry('reminder.create', reminder.id)];
  const round = await run(base, {
    createReminder: async () => ({ id: 'R1' }),
    getGarden: async () => [
      serverPlant({
        reminders: [{ id: 'R1', type: 'watering', interval_days: 7, time_of_day: '09:00:00', enabled: true }],
      }),
    ],
  });
  return { base, round, plant: base.plants[0], reminder };
}

test('editing a reminder whose create is in flight queues an update with the new values', async () => {
  const { base, round, reminder } = await reminderCreateInFlight();

  const current = act(base, { type: 'reminder/update', id: reminder.id, patch: { intervalDays: 3 } });
  const next = applySyncRound(current, round);

  expect(next.reminders).toEqual([expect.objectContaining({ serverId: 'R1', intervalDays: 3 })]);
  expect(next.outbox).toEqual([entry('reminder.update', reminder.id, 'R1')]);
});

test('deleting a reminder whose create is in flight queues a delete for the orphan', async () => {
  const { base, round, reminder } = await reminderCreateInFlight();

  const current = act(base, { type: 'reminder/delete', id: reminder.id });
  const next = applySyncRound(current, round);

  expect(next.reminders).toEqual([]);
  expect(next.outbox).toEqual([entry('reminder.delete', reminder.id, 'R1')]);
});

test('deleting a plant while it and its reminder are being created queues only the plant’s delete', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', reminders: [{ action: 'water' }] }] });
  const [plant] = base.plants;
  const [reminder] = base.reminders;
  base.outbox = [entry('plant.create', plant.id), entry('reminder.create', reminder.id)];
  const round = await run(base, {
    addPlant: async () => ({ id: 'S1' }),
    createReminder: async () => ({ id: 'R1' }),
  });

  const current = act(base, { type: 'plant/delete', id: plant.id });
  const next = applySyncRound(current, round);

  // The server cascades a plant's reminders.
  expect(next.outbox).toEqual([entry('plant.delete', plant.id, 'S1')]);
});

/** A room still waiting on its create, which the round lands. */
async function roomCreateInFlight(api = {}) {
  const base = seedGarden({ now: NOW, rooms: ['Kitchen'] });
  const room = base.rooms[0];
  base.outbox = [entry('room.create', room.id)];
  let created = [];
  const round = await run(base, {
    listRooms: async () => created,
    createRoom: async () => {
      created = [{ id: 'RK', name: 'Kitchen', light: 'unknown', sort_order: 0 }];
      return created[0];
    },
    ...api,
  });
  return { base, round, room };
}

test('renaming a room whose create is in flight queues an update with the new name', async () => {
  const { base, round, room } = await roomCreateInFlight();

  const current = act(base, { type: 'room/rename', id: room.id, name: 'Galley' });
  const next = applySyncRound(current, round);

  expect(next.rooms).toEqual([expect.objectContaining({ serverId: 'RK', name: 'Galley' })]);
  expect(next.outbox).toEqual([entry('room.update', room.id, 'RK')]);
});

test('deleting a room whose create is in flight queues a delete for the orphan', async () => {
  const { base, round, room } = await roomCreateInFlight();

  const current = act(base, { type: 'room/delete', id: room.id });
  const next = applySyncRound(current, round);

  expect(next.rooms).toEqual([]); // and the pull doesn't re-adopt it
  expect(next.outbox).toEqual([entry('room.delete', room.id, 'RK')]);
});

describe('a landed create clears the plant’s dirty flags', () => {
  async function archivedPlantCreate() {
    const seeded = seedGarden({ now: NOW, plants: [{ nickname: 'Penny' }] });
    const plant = seeded.plants[0];
    const base = { ...act(seeded, { type: 'plant/archive', id: plant.id }), outbox: [entry('plant.create', plant.id)] };
    const round = await run(base, { addPlant: async () => ({ id: 'S1' }), getGarden: async () => [serverPlant()] });
    return { base, round, plant };
  }

  test('when nobody touched them during the round', async () => {
    const { base, round } = await archivedPlantCreate();
    expect(base.plants[0].dirty).toEqual({ archived: true });
    expect(applySyncRound(base, round).plants[0].dirty).toEqual({});
  });

  test('but not when the user changed them mid-round', async () => {
    const { base, round, plant } = await archivedPlantCreate();
    const current = act(base, { type: 'plant/archive', id: plant.id, archived: false });
    expect(applySyncRound(current, round).plants[0].dirty).toEqual({ archived: true });
  });
});

/** A reminder whose plant isn't on the server yet, so the drain puts its entry back. */
async function requeuedReminder(op) {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', reminders: [{ action: 'water' }] }] });
  const reminder = base.reminders[0];
  base.outbox = [entry(op, reminder.id)];
  const round = await run(base, {});
  expect(round.pushed.outbox).toEqual(base.outbox);
  expect(round.pushed.outbox[0]).not.toBe(base.outbox[0]); // re-queued as a new object
  return { base, round, reminder };
}

test('an entry the drain re-queued is carried over', async () => {
  const { base, round, reminder } = await requeuedReminder('reminder.create');
  expect(applySyncRound(base, round).outbox).toEqual([entry('reminder.create', reminder.id)]);
});

test('a re-queued entry is not duplicated when the user queued the same intent mid-round', async () => {
  const { base, round, reminder } = await requeuedReminder('reminder.complete');

  const current = act(base, { type: 'reminder/complete', id: reminder.id });
  const next = applySyncRound(current, round);

  expect(next.outbox).toEqual([entry('reminder.complete', reminder.id)]);
  expect(next.outbox[0]).toBe(current.outbox[0]); // the user's, not the round's
});

test('a re-queued entry is dropped when its row was deleted mid-round', async () => {
  const { base, round, reminder } = await requeuedReminder('reminder.create');

  const current = act(base, { type: 'reminder/delete', id: reminder.id });
  expect(applySyncRound(current, round).outbox).toEqual([]);
});

test('a room refused for the plan limit stays even if renamed mid-round, and its plants keep it', async () => {
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', room: 'Kitchen' }] });
  const room = base.rooms[0];
  base.outbox = [entry('room.create', room.id)];
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const round = await run(base, {
    createRoom: async () => {
      throw Object.assign(new Error('limit'), { status: 402 });
    },
  });
  warn.mockRestore();

  const current = act(base, { type: 'room/rename', id: room.id, name: 'Galley' });
  const next = applySyncRound(current, round);

  expect(next.rooms).toEqual([expect.objectContaining({ id: room.id, name: 'Galley', localOnly: true })]);
  expect(next.plants[0].roomId).toBe(room.id);
  expect(next.outbox).toEqual([]);
  // The refusal is carried over from the round, once.
  expect(next.failed).toEqual([expect.objectContaining({ op: 'room.create', localId: room.id, status: 402 })]);
  expect(applySyncRound(next, { ...round, base: next, pushed: next }).failed).toHaveLength(1);
});

test('completing a reminder during the round keeps the completion and its entry', async () => {
  const base = seedGarden({
    now: NOW,
    plants: [{ nickname: 'Penny', serverId: 'S1', reminders: [{ action: 'water', overrides: { serverId: 'R1' } }] }],
  });
  const reminder = base.reminders[0];
  const round = await run(base, {
    getGarden: async () => [
      serverPlant({
        reminders: [{ id: 'R1', type: 'watering', interval_days: 7, time_of_day: '09:00:00', last_done_at: null }],
      }),
    ],
  });

  const current = act(base, { type: 'reminder/complete', id: reminder.id });
  const next = applySyncRound(current, round);

  expect(next.reminders[0].lastDoneAt).toBe(AT);
  expect(next.outbox).toEqual([entry('reminder.complete', reminder.id, 'R1')]);
});

test('a round that learned nothing returns the current state by identity', () => {
  // The provider's persist, sync and reschedule effects key off identity, so a
  // copy here would cost a disk write and start another round.
  const base = seedGarden({ now: NOW, plants: [{ nickname: 'Penny', serverId: 'S1' }] });
  base.outbox = [entry('plant.update', base.plants[0].id, 'S1')];
  const round = { base, pushed: { ...base }, remote: null, now: AT };

  const current = act(base, { type: 'plant/rename', id: base.plants[0].id, nickname: 'Fern' });
  expect(applySyncRound(current, round)).toBe(current);
});
