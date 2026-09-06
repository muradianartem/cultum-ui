import { ApiError } from '../../api/client';
import { emptyState, makePlant, makeReminder, makeRoom } from '../model';
import { enqueue } from '../reducer';
import { drainOutbox, mergeGarden, syncGarden } from '../sync';

const NOW = '2026-09-05T09:00:00.000Z';

const serverPlant = (over = {}) => ({
  id: 'S1',
  species_key: 'monstera-deliciosa',
  nickname: 'Penny',
  location: 'Kitchen',
  acquired_at: '2026-08-01',
  reminders: [],
  care: { species_key: 'monstera-deliciosa', scientific_name: 'Monstera deliciosa' },
  ...over,
});

const serverReminder = (over = {}) => ({
  id: 'R1',
  user_plant_id: 'S1',
  type: 'watering',
  interval_days: 7,
  time_of_day: '09:00:00',
  enabled: true,
  last_done_at: null,
  ...over,
});

function local({ plants = [], reminders = [], rooms, outbox = [] } = {}) {
  const base = emptyState();
  return { ...base, plants, reminders, rooms: rooms ?? base.rooms, outbox };
}

// ---------------------------------------------------------------------------

describe('drainOutbox', () => {
  test('pushes a plant then its reminder, threading the new server ids', async () => {
    const plant = makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny', roomId: 'k' });
    const reminder = makeReminder({ plantId: plant.id, action: 'water', intervalDays: 7 });
    const state = local({
      plants: [plant],
      reminders: [reminder],
      rooms: [{ id: 'k', name: 'Kitchen', icon: 'kitchen' }],
      outbox: [
        { op: 'plant.create', localId: plant.id, serverId: null, attempts: 0 },
        { op: 'reminder.create', localId: reminder.id, serverId: null, attempts: 0 },
      ],
    });

    const calls = [];
    const api = {
      addPlant: (p) => (calls.push(['addPlant', p]), Promise.resolve({ id: 'S1' })),
      createReminder: (id, r) => (calls.push(['createReminder', id, r]), Promise.resolve({ id: 'R1' })),
    };

    const { state: next, stopped } = await drainOutbox(state, api);

    expect(stopped).toBe(false);
    expect(next.outbox).toEqual([]);
    expect(next.plants[0].serverId).toBe('S1');
    expect(next.reminders[0].serverId).toBe('R1');
    // The room's *name* is what the server stores as the plant's location.
    expect(calls[0][1]).toMatchObject({ speciesKey: 'monstera-deliciosa', location: 'Kitchen' });
    expect(calls[1]).toEqual(['createReminder', 'S1', {
      type: 'watering', intervalDays: 7, timeOfDay: '09:00', enabled: true,
    }]);
  });

  test('a push clears the dirty flags — the server now holds those values', async () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny' }), dirty: { nickname: true } };
    const state = local({
      plants: [plant],
      outbox: [{ op: 'plant.create', localId: plant.id, serverId: null, attempts: 0 }],
    });
    const { state: next } = await drainOutbox(state, { addPlant: async () => ({ id: 'S1' }) });
    expect(next.plants[0].dirty).toEqual({});
  });

  test('going offline stops the drain and keeps the rest of the queue', async () => {
    const state = local({
      outbox: [
        { op: 'reminder.delete', localId: 'a', serverId: 'RA', attempts: 0 },
        { op: 'reminder.delete', localId: 'b', serverId: 'RB', attempts: 0 },
      ],
    });
    const api = {
      deleteReminder: async (id) => {
        if (id === 'RB') throw new ApiError('offline', { code: 'offline' });
      },
    };
    const { state: next, stopped } = await drainOutbox(state, api);
    expect(stopped).toBe(true);
    expect(next.outbox.map((e) => e.serverId)).toEqual(['RB']);
  });

  test('a rejection the server will never accept is dropped, not retried forever', async () => {
    const state = local({
      outbox: [{ op: 'reminder.delete', localId: 'a', serverId: 'RA', attempts: 0 }],
    });
    const api = {
      deleteReminder: async () => {
        throw new ApiError('gone', { code: 'http', status: 404 });
      },
    };
    const { state: next, stopped } = await drainOutbox(state, api);
    expect(stopped).toBe(false);
    expect(next.outbox).toEqual([]);
  });

  test('a reminder whose plant never reached the server is re-queued, not stranded', async () => {
    const plant = makePlant({ speciesKey: 'm', nickname: 'Penny' });
    const reminder = makeReminder({ plantId: plant.id });
    const state = local({
      plants: [plant],
      reminders: [reminder],
      outbox: [{ op: 'reminder.create', localId: reminder.id, serverId: null, attempts: 0 }],
    });
    const api = { createReminder: async () => { throw new Error('should not be called'); } };
    const { state: next } = await drainOutbox(state, api);

    expect(next.reminders[0].serverId).toBeNull();
    // Still on the queue, so the next sync picks it up once the plant lands.
    expect(next.outbox.map((e) => e.op)).toEqual(['reminder.create']);
  });

  test('a completion made before the first sync still reaches the server', async () => {
    // ReminderCreate carries no last_done_at, so the completion has to be a
    // second call — and it has to survive until the create gives it an id.
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny' }), serverId: 'S1' };
    const reminder = makeReminder({ plantId: plant.id, intervalDays: 7 });
    const state = local({
      plants: [plant],
      reminders: [reminder],
      outbox: [
        { op: 'reminder.create', localId: reminder.id, serverId: null, attempts: 0 },
        { op: 'reminder.complete', localId: reminder.id, serverId: null, attempts: 0 },
      ],
    });

    const completed = [];
    const api = {
      createReminder: async () => ({ id: 'R1' }),
      completeReminder: async (id) => completed.push(id),
    };
    const { state: next } = await drainOutbox(state, api);

    expect(next.reminders[0].serverId).toBe('R1');
    expect(completed).toEqual(['R1']);
    expect(next.outbox).toEqual([]);
  });

  test('a completion whose reminder is still unsynced waits rather than vanishing', async () => {
    const plant = makePlant({ speciesKey: 'm', nickname: 'Penny' });
    const reminder = makeReminder({ plantId: plant.id });
    const state = local({
      plants: [plant],
      reminders: [reminder],
      outbox: [{ op: 'reminder.complete', localId: reminder.id, serverId: null, attempts: 0 }],
    });
    const { state: next } = await drainOutbox(state, {});
    expect(next.outbox.map((e) => e.op)).toEqual(['reminder.complete']);
  });
});

// ---------------------------------------------------------------------------

describe('mergeGarden', () => {
  test('adopts a plant this device has never seen, with its room and reminders', () => {
    const merged = mergeGarden(
      local(),
      [serverPlant({ reminders: [serverReminder()] })],
      NOW,
    );
    expect(merged.plants).toHaveLength(1);
    expect(merged.plants[0]).toMatchObject({ serverId: 'S1', nickname: 'Penny' });
    expect(merged.reminders[0]).toMatchObject({ serverId: 'R1', action: 'water', intervalDays: 7 });
    // The default catalog already has a Kitchen — matched, not duplicated.
    expect(merged.rooms.filter((r) => r.name === 'Kitchen')).toHaveLength(1);
    expect(merged.plants[0].roomId).toBe('kitchen');
  });

  test('creates a room for a location the device does not know', () => {
    const merged = mergeGarden(local(), [serverPlant({ location: 'Balcony' })], NOW);
    const room = merged.rooms.find((r) => r.name === 'Balcony');
    expect(room).toBeTruthy();
    expect(merged.plants[0].roomId).toBe(room.id);
  });

  test('a dirty field survives the pull — this is the whole reason dirty exists', () => {
    const plant = {
      ...makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Figgy', roomId: 'bedroom' }),
      serverId: 'S1',
      dirty: { nickname: true, roomId: true },
    };
    const merged = mergeGarden(local({ plants: [plant] }), [serverPlant()], NOW);
    expect(merged.plants[0].nickname).toBe('Figgy'); // server still says "Penny"
    expect(merged.plants[0].roomId).toBe('bedroom'); // server still says "Kitchen"
    // Care data has no local edit, so the server's copy lands.
    expect(merged.plants[0].care.scientific_name).toBe('Monstera deliciosa');
  });

  test('a clean field takes the server value', () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Stale' }), serverId: 'S1' };
    const merged = mergeGarden(local({ plants: [plant] }), [serverPlant()], NOW);
    expect(merged.plants[0].nickname).toBe('Penny');
  });

  test('a plant deleted on another device goes, along with its reminders', () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny' }), serverId: 'S1' };
    const reminder = { ...makeReminder({ plantId: plant.id }), serverId: 'R1' };
    const merged = mergeGarden(local({ plants: [plant], reminders: [reminder] }), [], NOW);
    expect(merged.plants).toEqual([]);
    expect(merged.reminders).toEqual([]);
  });

  test('a plant still waiting to be created is never touched by a pull', () => {
    const plant = makePlant({ speciesKey: 'm', nickname: 'Penny' });
    const reminder = makeReminder({ plantId: plant.id });
    const merged = mergeGarden(local({ plants: [plant], reminders: [reminder] }), [], NOW);
    expect(merged.plants).toHaveLength(1);
    expect(merged.reminders).toHaveLength(1);
  });

  test('an unsent reminder edit beats the server copy', () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny' }), serverId: 'S1' };
    const reminder = { ...makeReminder({ plantId: plant.id, intervalDays: 3 }), serverId: 'R1' };
    const state = local({
      plants: [plant],
      reminders: [reminder],
      outbox: enqueue([], 'reminder.update', reminder.id, 'R1'),
    });
    const merged = mergeGarden(state, [serverPlant({ reminders: [serverReminder()] })], NOW);
    expect(merged.reminders[0].intervalDays).toBe(3); // not the server's 7
  });

  test('a synced reminder takes the server cadence and completion, keeping its local title', () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny' }), serverId: 'S1' };
    const reminder = {
      ...makeReminder({ plantId: plant.id, action: 'prune', title: 'Trim the aerial roots' }),
      serverId: 'R1',
    };
    const merged = mergeGarden(
      local({ plants: [plant], reminders: [reminder] }),
      [serverPlant({ reminders: [serverReminder({ type: 'custom', interval_days: 14, last_done_at: NOW })] })],
      NOW,
    );
    expect(merged.reminders[0]).toMatchObject({
      title: 'Trim the aerial roots', // the server has nowhere to store this
      action: 'prune',
      intervalDays: 14,
      lastDoneAt: NOW,
    });
  });

  test('two devices spelling a room differently land in one room', () => {
    const merged = mergeGarden(
      local({ rooms: [makeRoom('kitchen')] }),
      [serverPlant({ location: 'Kitchen' })],
      NOW,
    );
    expect(merged.rooms.filter((r) => /kitchen/i.test(r.name))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe('syncGarden', () => {
  test('pushes, pulls and returns the merged document', async () => {
    const plant = makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny' });
    const state = local({
      plants: [plant],
      outbox: [{ op: 'plant.create', localId: plant.id, serverId: null, attempts: 0 }],
    });
    const api = {
      addPlant: async () => ({ id: 'S1' }),
      getGarden: async () => [serverPlant()],
    };
    const next = await syncGarden(state, api, NOW);
    expect(next.plants[0].serverId).toBe('S1');
    expect(next.outbox).toEqual([]);
    expect(next.lastSyncAt).toBe(NOW);
  });

  test('a pull that changes nothing leaves the outbox identical', async () => {
    // The provider re-runs sync whenever the outbox changes, so a pull that
    // found no news must not hand back a new array — that would make every
    // sync schedule the next one.
    const state = local();
    const api = { getGarden: async () => [] };
    const next = await syncGarden(state, api, NOW);
    expect(next.outbox).toBe(state.outbox);
  });

  test('a failed pull leaves state alone rather than throwing at the UI', async () => {
    const api = {
      getGarden: async () => {
        throw new ApiError('offline', { code: 'offline' });
      },
    };
    expect(await syncGarden(local(), api, NOW)).toBeNull();
  });

  test('losing the connection mid-push still commits the ids already earned', async () => {
    const a = makePlant({ speciesKey: 'a', nickname: 'A' });
    const b = makePlant({ speciesKey: 'b', nickname: 'B' });
    const state = local({
      plants: [a, b],
      outbox: [
        { op: 'plant.create', localId: a.id, serverId: null, attempts: 0 },
        { op: 'plant.create', localId: b.id, serverId: null, attempts: 0 },
      ],
    });
    let n = 0;
    const api = {
      addPlant: async () => {
        n += 1;
        if (n === 2) throw new ApiError('down', { code: 'network' });
        return { id: 'SA' };
      },
      getGarden: async () => [],
    };
    const next = await syncGarden(state, api, NOW);
    expect(next.plants.find((p) => p.id === a.id).serverId).toBe('SA');
    expect(next.outbox).toHaveLength(1); // b is still queued
  });
});
