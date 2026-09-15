import { API_BASE_URL, ApiError } from '../../api/client';
import { emptyState, makePlant, makeReminder, makeRoom } from '../model';
import { enqueue } from '../reducer';
import { drainOutbox, mergeGarden, syncGarden } from '../sync';

const NOW = '2026-09-05T09:00:00.000Z';

const serverPlant = (over = {}) => ({
  id: 'S1',
  species_key: 'monstera-deliciosa',
  nickname: 'Penny',
  room_id: null,
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

const serverRoom = (over = {}) => ({
  id: 'RK',
  name: 'Kitchen',
  light: 'unknown',
  sort_order: 0,
  plant_count: 0,
  ...over,
});

/** A local room the server already has. */
const syncedRoom = (name, serverId, over = {}) => ({ ...makeRoom({ name }), serverId, ...over });

function local({ plants = [], reminders = [], rooms = [], outbox = [] } = {}) {
  return { ...emptyState(), plants, reminders, rooms, outbox };
}

const entry = (op, localId, serverId = null) => ({ op, localId, serverId, attempts: 0 });

// ---------------------------------------------------------------------------

describe('drainOutbox', () => {
  test('pushes a plant then its reminder, threading the new server ids', async () => {
    const room = syncedRoom('Kitchen', 'RK');
    const plant = makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny', roomId: room.id });
    const reminder = makeReminder({ plantId: plant.id, action: 'water', intervalDays: 7 });
    const state = local({
      plants: [plant],
      reminders: [reminder],
      rooms: [room],
      outbox: [entry('plant.create', plant.id), entry('reminder.create', reminder.id)],
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
    // The plant's room goes as the room's *server* id.
    expect(calls[0][1]).toMatchObject({ speciesKey: 'monstera-deliciosa', roomId: 'RK' });
    expect(calls[1]).toEqual(['createReminder', 'S1', {
      type: 'watering', intervalDays: 7, timeOfDay: '09:00', enabled: true,
    }]);
  });

  test('a push clears the dirty flags — the server now holds those values', async () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny' }), dirty: { nickname: true } };
    const state = local({ plants: [plant], outbox: [entry('plant.create', plant.id)] });
    const { state: next } = await drainOutbox(state, { addPlant: async () => ({ id: 'S1' }) });
    expect(next.plants[0].dirty).toEqual({});
  });

  test('going offline stops the drain and keeps the rest of the queue', async () => {
    const state = local({
      outbox: [entry('reminder.delete', 'a', 'RA'), entry('reminder.delete', 'b', 'RB')],
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
    const state = local({ outbox: [entry('reminder.delete', 'a', 'RA')] });
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
      outbox: [entry('reminder.create', reminder.id)],
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
      outbox: [entry('reminder.create', reminder.id), entry('reminder.complete', reminder.id)],
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
      outbox: [entry('reminder.complete', reminder.id)],
    });
    const { state: next } = await drainOutbox(state, {});
    expect(next.outbox.map((e) => e.op)).toEqual(['reminder.complete']);
  });
});

describe('drainOutbox — rooms', () => {
  test('creates a room, then the plant in it with the room’s new server id', async () => {
    const room = makeRoom({ name: 'Kitchen' });
    const plant = makePlant({ speciesKey: 'm', nickname: 'Penny', roomId: room.id });
    const state = local({
      rooms: [room],
      plants: [plant],
      outbox: [entry('room.create', room.id), entry('plant.create', plant.id)],
    });
    const created = [];
    const api = {
      listRooms: async () => [],
      createRoom: async (r) => (created.push(r), { id: 'RK' }),
      addPlant: async (p) => (created.push(p), { id: 'S1' }),
    };

    const { state: next } = await drainOutbox(state, api);

    expect(next.rooms[0].serverId).toBe('RK');
    expect(created[0]).toEqual({ name: 'Kitchen', icon: 'kitchen', light: 'unknown', sortOrder: 0 });
    expect(created[1]).toMatchObject({ roomId: 'RK' });
    expect(next.outbox).toEqual([]);
  });

  test('a plant whose room is not on the server yet waits instead of going roomless', async () => {
    const room = makeRoom({ name: 'Kitchen' });
    const plant = makePlant({ speciesKey: 'm', nickname: 'Penny', roomId: room.id });
    const state = local({ rooms: [room], plants: [plant], outbox: [entry('plant.create', plant.id)] });
    const api = { addPlant: async () => { throw new Error('should not be called'); } };

    const { state: next } = await drainOutbox(state, api);

    expect(next.plants[0].serverId).toBeNull();
    expect(next.outbox.map((e) => e.op)).toEqual(['plant.create']);
  });

  test('a same-named room already on the server is adopted, not duplicated', async () => {
    const room = makeRoom({ name: 'kitchen ' });
    const state = local({ rooms: [room], outbox: [entry('room.create', room.id)] });
    const api = {
      listRooms: async () => [serverRoom({ id: 'RK', name: 'Kitchen' })],
      createRoom: async () => { throw new Error('should not be called'); },
    };
    const { state: next } = await drainOutbox(state, api);
    expect(next.rooms[0].serverId).toBe('RK');
  });

  test('the server room list is fetched once per drain, however many rooms are created', async () => {
    const a = makeRoom({ name: 'Kitchen' });
    const b = makeRoom({ name: 'Balcony' });
    const listRooms = jest.fn(async () => []);
    let n = 0;
    const api = { listRooms, createRoom: async () => ({ id: `R${(n += 1)}` }) };
    const state = local({ rooms: [a, b], outbox: [entry('room.create', a.id), entry('room.create', b.id)] });

    const { state: next } = await drainOutbox(state, api);

    expect(listRooms).toHaveBeenCalledTimes(1);
    expect(next.rooms.map((r) => r.serverId)).toEqual(['R1', 'R2']);
  });

  test('two local rooms with one name do not both claim the same server room', async () => {
    const a = makeRoom({ name: 'Kitchen' });
    const b = makeRoom({ name: 'Kitchen' });
    const api = {
      listRooms: async () => [serverRoom({ id: 'RK' })],
      createRoom: async () => ({ id: 'RK2' }),
    };
    const state = local({ rooms: [a, b], outbox: [entry('room.create', a.id), entry('room.create', b.id)] });
    const { state: next } = await drainOutbox(state, api);
    expect(next.rooms.map((r) => r.serverId)).toEqual(['RK', 'RK2']);
  });

  test('a room over the plan limit is removed, and its plants lose the room', async () => {
    const room = makeRoom({ name: 'Balcony' });
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny', roomId: room.id }), serverId: 'S1' };
    const state = local({ rooms: [room], plants: [plant], outbox: [entry('room.create', room.id)] });
    const api = {
      listRooms: async () => [],
      createRoom: async () => { throw new ApiError('limit', { code: 'unauthorized', status: 403 }); },
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { state: next, stopped } = await drainOutbox(state, api);

    expect(stopped).toBe(false);
    expect(next.rooms).toEqual([]);
    expect(next.plants[0].roomId).toBeNull();
    expect(next.outbox).toEqual([]);
    warn.mockRestore();
  });

  test('a rename and a delete go to the room’s server id', async () => {
    const room = syncedRoom('Galley', 'RK');
    const state = local({
      rooms: [room],
      outbox: [entry('room.update', room.id, 'RK'), entry('room.delete', 'gone', 'RD')],
    });
    const calls = [];
    const api = {
      updateRoom: async (id, patch) => calls.push(['update', id, patch]),
      deleteRoom: async (id) => calls.push(['delete', id]),
    };
    await drainOutbox(state, api);
    expect(calls).toEqual([
      ['update', 'RK', { name: 'Galley', icon: 'home', light: 'unknown', sortOrder: 0 }],
      ['delete', 'RD'],
    ]);
  });

  test('a move or rename is pushed as a PATCH with the room’s server id', async () => {
    const room = syncedRoom('Kitchen', 'RK');
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Figgy', roomId: room.id }), serverId: 'S1' };
    const state = local({ rooms: [room], plants: [plant], outbox: [entry('plant.update', plant.id, 'S1')] });
    const calls = [];
    const api = { updatePlant: async (id, patch) => calls.push([id, patch]) };

    const { state: next } = await drainOutbox(state, api);

    expect(calls).toEqual([['S1', { nickname: 'Figgy', roomId: 'RK' }]]);
    expect(next.outbox).toEqual([]);
  });

  test('a plant taken out of its room is pushed with an explicit null room', async () => {
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Figgy' }), serverId: 'S1' };
    const calls = [];
    const api = { updatePlant: async (id, patch) => calls.push([id, patch]) };
    await drainOutbox(local({ plants: [plant], outbox: [entry('plant.update', plant.id, 'S1')] }), api);
    expect(calls).toEqual([['S1', { nickname: 'Figgy', roomId: null }]]);
  });
});

// ---------------------------------------------------------------------------

describe('mergeGarden', () => {
  test('adopts a plant this device has never seen, with its room and reminders', () => {
    const merged = mergeGarden(
      local(),
      [serverPlant({ room_id: 'RK', reminders: [serverReminder()] })],
      NOW,
      [serverRoom()],
    );
    expect(merged.plants).toHaveLength(1);
    expect(merged.plants[0]).toMatchObject({ serverId: 'S1', nickname: 'Penny' });
    expect(merged.reminders[0]).toMatchObject({ serverId: 'R1', action: 'water', intervalDays: 7 });
    expect(merged.rooms).toHaveLength(1);
    expect(merged.plants[0].roomId).toBe(merged.rooms[0].id);
  });

  // The catalog serves image_url as a root-relative '/media/...' path. An
  // <Image> given that renders nothing, which is what made every card go blank
  // after a sign-out: the document is deleted, so signing back in re-adopts
  // every plant through this path rather than from the add-a-plant flow (which
  // absolutises via api/mapPlant.js).
  test('absolutises the catalog image path on a plant adopted from the server', () => {
    const merged = mergeGarden(
      local(),
      [serverPlant({ image_url: '/media/species/monstera-deliciosa/card.jpg' })],
      NOW,
    );
    expect(merged.plants[0].heroUri).toBe(
      `${API_BASE_URL}/media/species/monstera-deliciosa/card.jpg`,
    );
  });

  test('falls back to the care blob for the image, absolutised the same way', () => {
    const merged = mergeGarden(
      local(),
      [serverPlant({ care: { image_url: '/media/species/x/card.jpg' } })],
      NOW,
    );
    expect(merged.plants[0].heroUri).toBe(`${API_BASE_URL}/media/species/x/card.jpg`);
  });

  test('leaves an already-absolute image url alone', () => {
    const merged = mergeGarden(
      local(),
      [serverPlant({ image_url: 'https://cdn.example/card.jpg' })],
      NOW,
    );
    expect(merged.plants[0].heroUri).toBe('https://cdn.example/card.jpg');
  });

  test('a plant this device already knows gets its image absolutised too', () => {
    const plant = { ...makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny' }), serverId: 'S1' };
    const merged = mergeGarden(
      local({ plants: [plant] }),
      [serverPlant({ image_url: '/media/species/monstera-deliciosa/card.jpg' })],
      NOW,
    );
    expect(merged.plants[0].heroUri).toBe(
      `${API_BASE_URL}/media/species/monstera-deliciosa/card.jpg`,
    );
  });

  // The cached file is the only picture that survives a pull, so the merge must
  // not treat it as a field the server is entitled to overwrite.
  test('keeps the locally cached image file across a pull', () => {
    const plant = {
      ...makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny' }),
      serverId: 'S1',
      imageFile: 'media/abc.jpg',
    };
    const merged = mergeGarden(local({ plants: [plant] }), [serverPlant()], NOW);
    expect(merged.plants[0].imageFile).toBe('media/abc.jpg');
  });

  test('a plant with a queued update keeps its local name and room over the server copy', () => {
    const kitchen = syncedRoom('Kitchen', 'RK');
    const bedroom = syncedRoom('Bedroom', 'RB');
    const plant = {
      ...makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Figgy', roomId: bedroom.id }),
      serverId: 'S1',
    };
    const state = local({
      rooms: [kitchen, bedroom],
      plants: [plant],
      outbox: enqueue([], 'plant.update', plant.id, 'S1'),
    });
    const merged = mergeGarden(
      state,
      [serverPlant({ room_id: 'RK' })],
      NOW,
      [serverRoom({ id: 'RK' }), serverRoom({ id: 'RB', name: 'Bedroom' })],
    );
    expect(merged.plants[0].nickname).toBe('Figgy'); // server still says "Penny"
    expect(merged.plants[0].roomId).toBe(bedroom.id); // server still says Kitchen
    // Care data has no local edit, so the server's copy lands.
    expect(merged.plants[0].care.scientific_name).toBe('Monstera deliciosa');
  });

  test('a clean plant takes the server name and room', () => {
    const kitchen = syncedRoom('Kitchen', 'RK');
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Stale' }), serverId: 'S1' };
    const merged = mergeGarden(
      local({ rooms: [kitchen], plants: [plant] }),
      [serverPlant({ room_id: 'RK' })],
      NOW,
      [serverRoom()],
    );
    expect(merged.plants[0].nickname).toBe('Penny');
    expect(merged.plants[0].roomId).toBe(kitchen.id);
  });

  test('a plant the server has taken out of its room loses it here too', () => {
    const kitchen = syncedRoom('Kitchen', 'RK');
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny', roomId: kitchen.id }), serverId: 'S1' };
    const merged = mergeGarden(
      local({ rooms: [kitchen], plants: [plant] }),
      [serverPlant({ room_id: null })],
      NOW,
      [serverRoom()],
    );
    expect(merged.plants[0].roomId).toBeNull();
  });

  test('without a room list, rooms are untouched and a plant keeps a room it can’t resolve', () => {
    const kitchen = makeRoom({ name: 'Kitchen' });
    const plant = { ...makePlant({ speciesKey: 'm', nickname: 'Penny', roomId: kitchen.id }), serverId: 'S1' };
    const state = local({ rooms: [kitchen], plants: [plant] });
    const merged = mergeGarden(state, [serverPlant({ room_id: 'RK' })], NOW);
    expect(merged.rooms).toBe(state.rooms);
    expect(merged.plants[0].roomId).toBe(kitchen.id);
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
});

describe('mergeGarden — rooms', () => {
  test('adopts server rooms in the server’s order, with a name-based icon until the server sends one', () => {
    const merged = mergeGarden(local(), [], NOW, [
      serverRoom({ id: 'RB', name: 'Bathroom', sort_order: 1, light: 'low' }),
      serverRoom({ id: 'RX', name: 'Studio', sort_order: 2, icon: 'office' }),
    ]);
    expect(merged.rooms.map((r) => [r.name, r.icon, r.light, r.sortOrder, r.serverId])).toEqual([
      ['Bathroom', 'shower', 'low', 1, 'RB'],
      ['Studio', 'office', 'unknown', 2, 'RX'], // the server's icon wins over the fallback
    ]);
  });

  test('a synced room takes the server’s name, order and icon', () => {
    const room = syncedRoom('Kitchen', 'RK');
    const merged = mergeGarden(local({ rooms: [room] }), [], NOW, [
      serverRoom({ name: 'Galley', sort_order: 3, icon: 'home' }),
    ]);
    expect(merged.rooms).toEqual([
      expect.objectContaining({ id: room.id, name: 'Galley', sortOrder: 3, icon: 'home' }),
    ]);
  });

  test('a queued rename beats the server name', () => {
    const room = syncedRoom('Galley', 'RK');
    const state = local({ rooms: [room], outbox: enqueue([], 'room.update', room.id, 'RK') });
    const merged = mergeGarden(state, [], NOW, [serverRoom({ name: 'Kitchen' })]);
    expect(merged.rooms[0].name).toBe('Galley');
  });

  test('a room still waiting on its create is kept', () => {
    const room = makeRoom({ name: 'Balcony' });
    const merged = mergeGarden(local({ rooms: [room] }), [], NOW, []);
    expect(merged.rooms).toEqual([room]);
  });

  test('a room deleted on another device goes, and its plants lose the room', () => {
    const room = syncedRoom('Kitchen', 'RK');
    const synced = { ...makePlant({ speciesKey: 'm', nickname: 'Penny', roomId: room.id }), serverId: 'S1' };
    const pending = makePlant({ speciesKey: 'm', nickname: 'Figgy', roomId: room.id });
    const merged = mergeGarden(
      local({ rooms: [room], plants: [synced, pending] }),
      [serverPlant({ room_id: null })],
      NOW,
      [],
    );
    expect(merged.rooms).toEqual([]);
    expect(merged.plants.map((p) => p.roomId)).toEqual([null, null]);
  });

  test('a room with a delete still queued is not re-adopted', () => {
    const state = local({ outbox: [entry('room.delete', 'room_gone', 'RK')] });
    const merged = mergeGarden(state, [], NOW, [serverRoom()]);
    expect(merged.rooms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('syncGarden', () => {
  test('pushes, pulls rooms and plants, and returns the merged document', async () => {
    const plant = makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny' });
    const state = local({ plants: [plant], outbox: [entry('plant.create', plant.id)] });
    const api = {
      addPlant: async () => ({ id: 'S1' }),
      listRooms: async () => [serverRoom()],
      getGarden: async () => [serverPlant({ room_id: 'RK' })],
    };
    const next = await syncGarden(state, api, NOW);
    expect(next.plants[0].serverId).toBe('S1');
    expect(next.rooms.map((r) => r.name)).toEqual(['Kitchen']);
    expect(next.plants[0].roomId).toBe(next.rooms[0].id);
    expect(next.outbox).toEqual([]);
    expect(next.lastSyncAt).toBe(NOW);
  });

  test('a pull that changes nothing leaves the outbox identical', async () => {
    // The provider re-runs sync whenever the outbox changes, so a pull that
    // found no news must not hand back a new array — that would make every
    // sync schedule the next one.
    const state = local();
    const api = { listRooms: async () => [], getGarden: async () => [] };
    const next = await syncGarden(state, api, NOW);
    expect(next.outbox).toBe(state.outbox);
  });

  test('a failed pull leaves state alone rather than throwing at the UI', async () => {
    const api = {
      listRooms: async () => [],
      getGarden: async () => {
        throw new ApiError('offline', { code: 'offline' });
      },
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await syncGarden(local(), api, NOW)).toBeNull();
    warn.mockRestore();
  });

  test('losing the connection mid-push still commits the ids already earned', async () => {
    const a = makePlant({ speciesKey: 'a', nickname: 'A' });
    const b = makePlant({ speciesKey: 'b', nickname: 'B' });
    const state = local({
      plants: [a, b],
      outbox: [entry('plant.create', a.id), entry('plant.create', b.id)],
    });
    let n = 0;
    const api = {
      addPlant: async () => {
        n += 1;
        if (n === 2) throw new ApiError('down', { code: 'network' });
        return { id: 'SA' };
      },
      listRooms: async () => [],
      getGarden: async () => [],
    };
    const next = await syncGarden(state, api, NOW);
    expect(next.plants.find((p) => p.id === a.id).serverId).toBe('SA');
    expect(next.outbox).toHaveLength(1); // b is still queued
  });
});
