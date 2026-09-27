import { STATE_VERSION, emptyState } from '../model';
import { clearState, createSaver, loadState, migrate, saveState } from '../persist';
import { seedGarden } from '../testing';

jest.useFakeTimers();

describe('the document on disk', () => {
  // jest.setup.js backs expo-file-system with an in-memory map, so this is a
  // real round trip through the same code the app runs.
  beforeEach(() => clearState());

  test('a garden survives being written and read back', async () => {
    const garden = seedGarden({
      now: new Date(2026, 8, 5),
      plants: [
        { nickname: 'Penny', room: 'Kitchen', reminders: [{ action: 'water', intervalDays: 7 }] },
      ],
    });

    expect(await saveState(garden)).toBe(true);
    const loaded = await loadState();

    expect(loaded.plants).toHaveLength(1);
    expect(loaded.plants[0].nickname).toBe('Penny');
    expect(loaded.reminders[0].intervalDays).toBe(7);
    // Read back as a mirror, never as the server's current answer.
    expect(loaded).toEqual({ ...garden, status: 'loading' });
  });

  test('the load status is never written', async () => {
    await saveState({ ...emptyState(), status: 'error', error: new Error('x') });
    const raw = JSON.parse(require('expo-file-system').__files.get('file:///documents/cultum-garden.json'));
    expect(raw).not.toHaveProperty('status');
    expect(raw).not.toHaveProperty('error');
  });

  test('a second write replaces the first rather than appending', async () => {
    await saveState({ ...emptyState(), profileName: 'first' });
    await saveState({ ...emptyState(), profileName: 'second' });
    expect((await loadState()).profileName).toBe('second');
  });

  test('a first launch — nothing on disk — is an empty garden, not an error', async () => {
    expect(await loadState()).toEqual(emptyState());
  });

  test('clearing takes the document with it', async () => {
    await saveState({ ...emptyState(), profileName: 'gone' });
    await clearState();
    expect((await loadState()).profileName).toBeNull();
  });
});

describe('migrate', () => {
  test('garbage, or nothing at all, is an empty garden rather than a crash', () => {
    expect(migrate(null)).toEqual(emptyState());
    expect(migrate('nope')).toEqual(emptyState());
  });

  test('a document from a newer build is not guessed at', () => {
    expect(migrate({ version: STATE_VERSION + 1, plants: [{ id: 'x' }] })).toEqual(emptyState());
  });

  test('a current document keeps its lists and loads as not-yet-answered', () => {
    const doc = {
      version: STATE_VERSION,
      plants: [{ id: 'P1', nickname: 'Penny', roomId: 'R1' }],
      reminders: [],
      rooms: [{ id: 'R1', name: 'Kitchen' }],
      profileName: 'Ada',
    };
    expect(migrate(doc)).toEqual({ ...emptyState(), ...doc, version: STATE_VERSION, status: 'loading' });
  });
});

describe('migrate from the offline-first builds (v1, v2)', () => {
  const v2 = {
    version: 2,
    profileName: 'Ada',
    rooms: [
      { id: 'room_a', serverId: 'RK', name: 'Kitchen', icon: 'kitchen', sortOrder: 0 },
      { id: 'room_b', serverId: null, name: 'Never pushed', sortOrder: 1 },
    ],
    plants: [
      {
        id: 'plant_a', serverId: 'P1', nickname: 'Penny', roomId: 'room_a', speciesKey: 'monstera',
        photoUri: 'file:///cam.jpg', imageFile: 'photos/p1.jpg', archived: true, dirty: { archived: true },
      },
      { id: 'plant_b', serverId: null, nickname: 'Unsynced', roomId: 'room_b' },
    ],
    reminders: [
      {
        id: 'rem_a', serverId: 'M1', plantId: 'plant_a', action: 'prune', title: 'Trim the top',
        intervalDays: 90, timeOfDay: '08:00', enabled: true, startAt: '2026-09-01T12:00:00.000Z',
        lastDoneAt: null, snoozedUntil: '2026-09-20T09:00:00.000Z',
      },
      { id: 'rem_b', serverId: null, plantId: 'plant_b', action: 'water', intervalDays: 7 },
    ],
    outbox: [{ op: 'plant.create', localId: 'plant_b', serverId: null, attempts: 0 }],
    failed: [{ op: 'room.create', localId: 'room_b', status: 403 }],
    lastSyncAt: '2026-09-10T00:00:00.000Z',
  };

  test('only rows the server has survive, re-keyed to their server ids', () => {
    const m = migrate(v2);
    expect(m.rooms.map((r) => r.id)).toEqual(['RK']);
    expect(m.plants.map((p) => p.id)).toEqual(['P1']);
    expect(m.plants[0].roomId).toBe('RK');
    expect(m.reminders.map((r) => [r.id, r.plantId])).toEqual([['M1', 'P1']]);
  });

  test('the device-only fields come along', () => {
    const m = migrate(v2);
    expect(m.plants[0]).toMatchObject({ photoUri: 'file:///cam.jpg', imageFile: 'photos/p1.jpg' });
    expect(m.reminders[0]).toMatchObject({
      action: 'prune',
      title: 'Trim the top',
      startAt: '2026-09-01T12:00:00.000Z',
      snoozedUntil: '2026-09-20T09:00:00.000Z',
    });
    expect(m.profileName).toBe('Ada');
  });

  test('the outbox, rejected writes, sync stamps and archive flags are gone', () => {
    const m = migrate(v2);
    for (const key of ['outbox', 'failed', 'lastSyncAt']) expect(m).not.toHaveProperty(key);
    expect(m.plants[0]).not.toHaveProperty('archived');
    expect(m.plants[0]).not.toHaveProperty('dirty');
    expect(m.plants[0]).not.toHaveProperty('serverId');
    expect(m.status).toBe('loading');
    expect(m.version).toBe(STATE_VERSION);
  });
});


describe('createSaver', () => {
  test('a burst of mutations costs one write, with the last value', () => {
    const save = jest.fn();
    const saver = createSaver(400, save);
    saver.queue({ n: 1 });
    saver.queue({ n: 2 });
    saver.queue({ n: 3 });
    expect(save).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ n: 3 });
  });

  test('flush writes immediately — the process may not get another chance', () => {
    const save = jest.fn();
    const saver = createSaver(400, save);
    saver.queue({ n: 1 });
    saver.flush();
    expect(save).toHaveBeenCalledWith({ n: 1 });

    // Nothing pending: flushing again must not write a stale duplicate.
    saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
