import { emptyState, makePlant, makeReminder, makeRoom } from '../model';
import { enqueue, reducer } from '../reducer';

const NOW = '2026-09-05T09:00:00.000Z';

function seeded() {
  const plant = { ...makePlant({ speciesKey: 'monstera', nickname: 'Penny', roomId: 'kitchen' }), serverId: 'S1' };
  const reminder = { ...makeReminder({ plantId: plant.id, action: 'water' }), serverId: 'R1' };
  return { ...emptyState(), plants: [plant], reminders: [reminder], plant, reminder };
}

describe('enqueue', () => {
  test('collapses repeats of the same intent — the drain reads current state', () => {
    let q = enqueue([], 'reminder.update', 'r1', 'R1');
    q = enqueue(q, 'reminder.update', 'r1', 'R1');
    expect(q).toHaveLength(1);
  });

  test('keeps different ops on the same row, in order', () => {
    let q = enqueue([], 'reminder.update', 'r1', 'R1');
    q = enqueue(q, 'reminder.complete', 'r1', 'R1');
    expect(q.map((e) => e.op)).toEqual(['reminder.update', 'reminder.complete']);
  });
});

describe('plant/add', () => {
  test('writes the plant and its reminders in one commit, plant queued first', () => {
    const plant = makePlant({ speciesKey: 'monstera', nickname: 'Penny' });
    const reminders = [makeReminder({ plantId: plant.id, action: 'water' })];
    const s = reducer(emptyState(), { type: 'plant/add', plant, reminders, now: NOW });

    expect(s.plants).toHaveLength(1);
    expect(s.reminders).toHaveLength(1);
    expect(s.outbox.map((e) => e.op)).toEqual(['plant.create', 'reminder.create']);
  });
});

describe('local-only edits', () => {
  test('rename marks the field dirty — the backend has no PATCH to push it', () => {
    const s0 = seeded();
    const s = reducer(s0, { type: 'plant/rename', id: s0.plant.id, nickname: '  Figgy  ', now: NOW });
    expect(s.plants[0].nickname).toBe('Figgy');
    expect(s.plants[0].dirty).toEqual({ nickname: true });
    expect(s.outbox).toEqual([]); // nothing to send
  });

  test('renaming a room makes every plant in it locally authoritative', () => {
    const s0 = { ...seeded(), rooms: [makeRoom('Kitchen')] };
    const room = s0.rooms[0];
    const withPlant = { ...s0, plants: [{ ...s0.plant, roomId: room.id }] };
    const s = reducer(withPlant, { type: 'room/rename', id: room.id, name: 'Galley', now: NOW });
    expect(s.rooms[0].name).toBe('Galley');
    expect(s.plants[0].dirty).toEqual({ roomId: true });
  });

  test('deleting a room leaves its plants roomless rather than deleting them', () => {
    const room = makeRoom('Kitchen');
    const s0 = seeded();
    const withPlant = { ...s0, rooms: [room], plants: [{ ...s0.plant, roomId: room.id }] };
    const s = reducer(withPlant, { type: 'room/delete', id: room.id, now: NOW });
    expect(s.rooms).toEqual([]);
    expect(s.plants[0].roomId).toBeNull();
  });
});

describe('reminder lifecycle', () => {
  test('completing re-anchors the cadence and spends any snooze', () => {
    const s0 = seeded();
    const snoozed = { ...s0, reminders: [{ ...s0.reminder, snoozedUntil: NOW }] };
    const s = reducer(snoozed, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });
    expect(s.reminders[0].lastDoneAt).toBe(NOW);
    expect(s.reminders[0].snoozedUntil).toBeNull();
    expect(s.outbox.map((e) => e.op)).toEqual(['reminder.complete']);
  });

  test('a completion is queued even before the reminder exists on the server', () => {
    // ReminderCreate has no last_done_at field, so the completion must ride as
    // its own call; the create is ahead of it in the queue and supplies the id.
    const s0 = seeded();
    const local = { ...s0, reminders: [{ ...s0.reminder, serverId: null }] };
    const s = reducer(local, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });
    expect(s.outbox.map((e) => e.op)).toEqual(['reminder.complete']);
  });

  test('editing a reminder the server has never seen queues nothing extra', () => {
    const s0 = seeded();
    const local = { ...s0, reminders: [{ ...s0.reminder, serverId: null }] };
    const s = reducer(local, { type: 'reminder/update', id: s0.reminder.id, patch: { intervalDays: 3 }, now: NOW });
    expect(s.reminders[0].intervalDays).toBe(3);
    expect(s.outbox).toEqual([]); // its create will carry the new value
  });

  test('deleting something the server never saw forgets it instead of queueing', () => {
    const s0 = seeded();
    const local = {
      ...s0,
      reminders: [{ ...s0.reminder, serverId: null }],
      outbox: enqueue([], 'reminder.create', s0.reminder.id),
    };
    const s = reducer(local, { type: 'reminder/delete', id: s0.reminder.id, now: NOW });
    expect(s.reminders).toEqual([]);
    expect(s.outbox).toEqual([]);
  });

  test('deleting a synced reminder queues the delete with its server id', () => {
    const s0 = seeded();
    const s = reducer(s0, { type: 'reminder/delete', id: s0.reminder.id, now: NOW });
    expect(s.outbox).toEqual([
      { op: 'reminder.delete', localId: s0.reminder.id, serverId: 'R1', attempts: 0 },
    ]);
  });
});

describe('plants/images', () => {
  const withPlants = () => {
    const state = reducer(emptyState(), {
      type: 'plant/add',
      plant: makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny' }),
      reminders: [],
      now: NOW,
    });
    return state;
  };

  test('records where each picture landed', () => {
    const state = withPlants();
    const id = state.plants[0].id;
    const next = reducer(state, { type: 'plants/images', files: { [id]: 'media/abc.jpg' } });
    expect(next.plants[0].imageFile).toBe('media/abc.jpg');
  });

  // A cached file says nothing about the plant the server holds. Stamping it
  // would make every launch look like an edit worth pushing.
  test('does not stamp updatedAt or queue anything', () => {
    const state = withPlants();
    const id = state.plants[0].id;
    const next = reducer(state, { type: 'plants/images', files: { [id]: 'media/abc.jpg' } });
    expect(next.plants[0].updatedAt).toBe(state.plants[0].updatedAt);
    expect(next.outbox).toEqual(state.outbox);
  });

  test('an empty batch is the same object, so it cannot loop the effect that made it', () => {
    const state = withPlants();
    expect(reducer(state, { type: 'plants/images', files: {} })).toBe(state);
  });
});

describe('plant/delete', () => {
  test('takes the plant, its reminders and their queued work with it', () => {
    const s0 = seeded();
    const busy = { ...s0, outbox: enqueue([], 'reminder.update', s0.reminder.id, 'R1') };
    const s = reducer(busy, { type: 'plant/delete', id: s0.plant.id, now: NOW });

    expect(s.plants).toEqual([]);
    expect(s.reminders).toEqual([]);
    // Only the plant delete survives — the server cascades the rest.
    expect(s.outbox.map((e) => e.op)).toEqual(['plant.delete']);
    expect(s.outbox[0].serverId).toBe('S1');
  });

  test('an unsynced plant simply disappears', () => {
    const s0 = seeded();
    const local = { ...s0, plants: [{ ...s0.plant, serverId: null }] };
    const s = reducer(local, { type: 'plant/delete', id: s0.plant.id, now: NOW });
    expect(s.outbox).toEqual([]);
  });
});

describe('reminders/restore', () => {
  // What store/GardenProvider.js captures before it mutates.
  const snapshotOf = (state, ids) =>
    ids.map((id) => {
      const r = state.reminders.find((x) => x.id === id);
      return {
        id,
        lastDoneAt: r.lastDoneAt ?? null,
        snoozedUntil: r.snoozedUntil ?? null,
        updatedAt: r.updatedAt,
        wasQueued: state.outbox.some((e) => e.op === 'reminder.complete' && e.localId === id),
      };
    });

  test('undoing a completion is an exact inverse — rows and queue both', () => {
    const s0 = seeded();
    const entries = snapshotOf(s0, [s0.reminder.id]);
    const done = reducer(s0, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });
    expect(done.outbox.map((e) => e.op)).toEqual(['reminder.complete']);

    const back = reducer(done, { type: 'reminders/restore', entries, now: NOW });
    expect(back.reminders).toEqual(s0.reminders);
    expect(back.outbox).toEqual(s0.outbox);
  });

  test('undoing a snooze puts the previous snoozedUntil back', () => {
    const s0 = seeded();
    const snoozed = { ...s0, reminders: [{ ...s0.reminder, snoozedUntil: '2026-09-06T09:00:00.000Z' }] };
    const entries = snapshotOf(snoozed, [s0.reminder.id]);
    const again = reducer(snoozed, {
      type: 'reminder/snooze',
      id: s0.reminder.id,
      until: '2026-09-09T09:00:00.000Z',
      now: NOW,
    });

    const back = reducer(again, { type: 'reminders/restore', entries, now: NOW });
    expect(back.reminders[0].snoozedUntil).toBe('2026-09-06T09:00:00.000Z');
  });

  test('a completion that was already queued survives the undo of a later one', () => {
    const s0 = seeded();
    const first = reducer(s0, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });
    // Offline: the second completion collapses into the same queued entry.
    const entries = snapshotOf(first, [s0.reminder.id]);
    expect(entries[0].wasQueued).toBe(true);
    const second = reducer(first, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });

    const back = reducer(second, { type: 'reminders/restore', entries, now: NOW });
    expect(back.reminders[0].lastDoneAt).toBe(first.reminders[0].lastDoneAt);
    expect(back.outbox.map((e) => e.op)).toEqual(['reminder.complete']);
  });

  test('leaves other reminders and other queued ops alone', () => {
    const s0 = seeded();
    const other = { ...makeReminder({ plantId: s0.plant.id, action: 'mist' }), serverId: 'R2' };
    const both = {
      ...s0,
      reminders: [...s0.reminders, other],
      outbox: enqueue([], 'reminder.update', s0.reminder.id, 'R1'),
    };
    const entries = snapshotOf(both, [s0.reminder.id]);
    const done = reducer(both, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });

    const back = reducer(done, { type: 'reminders/restore', entries, now: NOW });
    expect(back.reminders[1]).toEqual(other);
    expect(back.outbox.map((e) => e.op)).toEqual(['reminder.update']);
  });

  test('an id that is gone, and an empty list, are both no-ops', () => {
    const s0 = seeded();
    expect(reducer(s0, { type: 'reminders/restore', entries: [], now: NOW })).toBe(s0);
    const ghost = [{ id: 'nope', lastDoneAt: null, snoozedUntil: null, wasQueued: false }];
    const s = reducer(s0, { type: 'reminders/restore', entries: ghost, now: NOW });
    expect(s.reminders).toEqual(s0.reminders);
    expect(s.outbox).toEqual(s0.outbox);
  });
});

test('an unknown action is a no-op, not a crash', () => {
  const s = emptyState();
  expect(reducer(s, { type: 'nope' })).toBe(s);
});
