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

describe('plant edits', () => {
  test('renaming a synced plant queues a PATCH rather than marking it dirty', () => {
    const s0 = seeded();
    const s = reducer(s0, { type: 'plant/rename', id: s0.plant.id, nickname: '  Figgy  ', now: NOW });
    expect(s.plants[0].nickname).toBe('Figgy');
    expect(s.plants[0].dirty).toEqual({});
    expect(s.outbox).toEqual([{ op: 'plant.update', localId: s0.plant.id, serverId: 'S1', attempts: 0 }]);
  });

  test('moving a synced plant queues a PATCH', () => {
    const s0 = seeded();
    const s = reducer(s0, { type: 'plant/move', id: s0.plant.id, roomId: 'bedroom', now: NOW });
    expect(s.plants[0].roomId).toBe('bedroom');
    expect(s.outbox.map((e) => e.op)).toEqual(['plant.update']);
  });

  test('an unsynced plant queues nothing — its create carries the new values', () => {
    const s0 = seeded();
    const unsynced = { ...s0, plants: [{ ...s0.plant, serverId: null }] };
    const s = reducer(unsynced, { type: 'plant/move', id: s0.plant.id, roomId: 'bedroom', now: NOW });
    expect(s.plants[0].roomId).toBe('bedroom');
    expect(s.outbox).toEqual([]);
  });

  test('archiving is still local-only, so the field is marked dirty', () => {
    const s0 = seeded();
    const s = reducer(s0, { type: 'plant/archive', id: s0.plant.id, now: NOW });
    expect(s.plants[0].dirty).toEqual({ archived: true });
    expect(s.outbox).toEqual([]);
  });
});

describe('rooms', () => {
  const synced = (name, serverId) => ({ ...makeRoom({ name }), serverId });

  test('adding a room puts it after the others and queues its create', () => {
    const s0 = { ...emptyState(), rooms: [{ ...synced('Kitchen', 'RK'), sortOrder: 4 }] };
    const room = makeRoom({ name: 'Balcony' });
    const s = reducer(s0, { type: 'room/add', room, now: NOW });
    expect(s.rooms.map((r) => [r.name, r.sortOrder])).toEqual([['Kitchen', 4], ['Balcony', 5]]);
    expect(s.outbox).toEqual([{ op: 'room.create', localId: room.id, serverId: null, attempts: 0 }]);
  });

  test('renaming a synced room queues an update, and touches none of its plants', () => {
    const room = synced('Kitchen', 'RK');
    const s0 = seeded();
    const withRoom = { ...s0, rooms: [room], plants: [{ ...s0.plant, roomId: room.id }] };
    const s = reducer(withRoom, { type: 'room/rename', id: room.id, name: ' Galley ', now: NOW });
    expect(s.rooms[0].name).toBe('Galley');
    expect(s.plants[0]).toBe(withRoom.plants[0]);
    expect(s.outbox).toEqual([{ op: 'room.update', localId: room.id, serverId: 'RK', attempts: 0 }]);
  });

  test('renaming a room still waiting on its create queues nothing more', () => {
    const room = makeRoom({ name: 'Kitchen' });
    const s0 = reducer(emptyState(), { type: 'room/add', room, now: NOW });
    const s = reducer(s0, { type: 'room/rename', id: room.id, name: 'Galley', now: NOW });
    expect(s.outbox.map((e) => e.op)).toEqual(['room.create']);
  });

  test('deleting a room leaves its plants roomless and queues the delete', () => {
    const room = synced('Kitchen', 'RK');
    const s0 = seeded();
    const withRoom = { ...s0, rooms: [room], plants: [{ ...s0.plant, roomId: room.id }] };
    const s = reducer(withRoom, { type: 'room/delete', id: room.id, now: NOW });
    expect(s.rooms).toEqual([]);
    expect(s.plants).toHaveLength(1);
    expect(s.plants[0].roomId).toBeNull();
    // The server empties the room itself, so the plant needs no push of its own.
    expect(s.outbox).toEqual([{ op: 'room.delete', localId: room.id, serverId: 'RK', attempts: 0 }]);
  });

  test('deleting a room the server never saw just forgets it', () => {
    const room = makeRoom({ name: 'Kitchen' });
    const s0 = reducer(emptyState(), { type: 'room/add', room, now: NOW });
    const s = reducer(s0, { type: 'room/delete', id: room.id, now: NOW });
    expect(s.rooms).toEqual([]);
    expect(s.outbox).toEqual([]);
  });

  test('move-and-delete re-homes every plant, queued ahead of the delete', () => {
    const from = synced('Living Room', 'RL');
    const to = synced('Kitchen', 'RK');
    const s0 = seeded();
    const other = { ...s0.plant, id: 'plant_2', serverId: 'S2' };
    const state = {
      ...s0,
      rooms: [from, to],
      plants: [{ ...s0.plant, roomId: from.id }, { ...other, roomId: from.id }],
    };
    const s = reducer(state, { type: 'room/deleteMoving', id: from.id, toRoomId: to.id, now: NOW });
    expect(s.rooms.map((r) => r.name)).toEqual(['Kitchen']);
    expect(s.plants.map((p) => p.roomId)).toEqual([to.id, to.id]);
    expect(s.outbox.map((e) => e.op)).toEqual(['plant.update', 'plant.update', 'room.delete']);
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

describe('reminders/timeOfDay', () => {
  const garden = (count, { serverIds = true } = {}) => {
    const plant = makePlant({ speciesKey: 'monstera-deliciosa', nickname: 'Penny' });
    const reminders = Array.from({ length: count }, (_, i) => ({
      ...makeReminder({ plantId: plant.id, action: 'water' }),
      id: `rem_${i}`,
      serverId: serverIds ? `R${i}` : null,
    }));
    return { ...emptyState(), plants: [plant], reminders };
  };

  test('moves every reminder and queues one update each', () => {
    const s = reducer(garden(3), { type: 'reminders/timeOfDay', timeOfDay: '07:30', now: NOW });
    expect(s.reminders.map((r) => r.timeOfDay)).toEqual(['07:30', '07:30', '07:30']);
    expect(s.outbox).toHaveLength(3);
    expect(s.outbox.every((e) => e.op === 'reminder.update')).toBe(true);
  });

  test('a reminder the server has never seen queues nothing', () => {
    // Its own create reads current state when it drains, so it carries the new
    // time by itself — queueing an update for it would be a round trip to
    // reach where we already are.
    const s = reducer(garden(3, { serverIds: false }), {
      type: 'reminders/timeOfDay',
      timeOfDay: '07:30',
      now: NOW,
    });
    expect(s.reminders.every((r) => r.timeOfDay === '07:30')).toBe(true);
    expect(s.outbox).toHaveLength(0);
  });

  test('re-picking the same time returns the state by identity', () => {
    // Load-bearing, not an optimisation: GardenProvider's persist, sync, media
    // and reschedule effects all key off the state object, so a new-but-equal
    // object would cost a disk write, a sync round and a full rebuild of the
    // OS notification queue for a setting nobody changed.
    const before = garden(3);
    const after = reducer(before, {
      type: 'reminders/timeOfDay',
      timeOfDay: before.reminders[0].timeOfDay,
      now: NOW,
    });
    expect(after).toBe(before);
  });

  test('re-timing five times over fifty reminders queues fifty entries, not 250', () => {
    // enqueue collapses per (op, localId), which is what keeps a wheel the user
    // scrolled through several values from flooding the outbox.
    let s = garden(50);
    for (const time of ['07:00', '08:00', '09:30', '10:00', '11:15']) {
      s = reducer(s, { type: 'reminders/timeOfDay', timeOfDay: time, now: NOW });
    }
    expect(s.outbox).toHaveLength(50);
    expect(s.reminders.every((r) => r.timeOfDay === '11:15')).toBe(true);
  });
});

test('an unknown action is a no-op, not a crash', () => {
  const s = emptyState();
  expect(reducer(s, { type: 'nope' })).toBe(s);
});

describe('sync/apply', () => {
  test('rebases the round onto the current state instead of replacing it', () => {
    const s0 = seeded();
    const pending = enqueue([], 'plant.update', s0.plant.id, 'S1');
    const base = { ...s0, outbox: pending };
    // The round pushed that PATCH; meanwhile the user queued a completion.
    const round = { base, pushed: { ...base, outbox: [] }, remote: null, now: NOW };
    const current = reducer(base, { type: 'reminder/complete', id: s0.reminder.id, now: NOW });

    const next = reducer(current, { type: 'sync/apply', round });

    expect(next.outbox.map((e) => e.op)).toEqual(['reminder.complete']);
    expect(next.reminders[0].lastDoneAt).toBe(NOW);
  });
});

describe('outbox entry identity', () => {
  // store/applySync.js tells which entries a sync round processed by identity,
  // so no reducer path may clone an entry it didn't mean to replace.
  const untouched = { op: 'room.update', localId: 'room_elsewhere', serverId: 'RX', attempts: 0 };

  function state() {
    const s = seeded();
    const room = { ...makeRoom({ name: 'Kitchen' }), id: 'kitchen', serverId: 'RK' };
    const office = { ...makeRoom({ name: 'Office' }), id: 'office', serverId: 'RO' };
    return { ...s, rooms: [room, office], outbox: [untouched] };
  }

  const actions = (s) => {
    const newPlant = makePlant({ speciesKey: 'ficus', nickname: 'Figgy' });
    return [
      { type: 'plant/add', plant: newPlant, reminders: [makeReminder({ plantId: newPlant.id, action: 'water' })] },
      { type: 'plant/rename', id: s.plant.id, nickname: 'Fern' },
      { type: 'plant/move', id: s.plant.id, roomId: 'office' },
      { type: 'plant/delete', id: s.plant.id },
      { type: 'room/add', name: 'Balcony' },
      { type: 'room/rename', id: 'kitchen', name: 'Galley' },
      { type: 'room/delete', id: 'kitchen' },
      { type: 'room/deleteMoving', id: 'kitchen', toRoomId: 'office' },
      { type: 'reminder/add', reminder: makeReminder({ plantId: s.plant.id, action: 'mist' }) },
      { type: 'reminder/update', id: s.reminder.id, patch: { intervalDays: 3 } },
      { type: 'reminders/timeOfDay', timeOfDay: '07:30' },
      { type: 'reminder/complete', id: s.reminder.id },
      { type: 'reminders/restore', entries: [{ id: s.reminder.id, lastDoneAt: null, wasQueued: false }] },
      { type: 'reminder/delete', id: s.reminder.id },
    ];
  };

  // One document for every case — the reducer is pure — so each action's ids
  // point at rows that exist and the action really runs.
  const s = state();
  test.each(actions(s).map((a) => [a.type, a]))('%s keeps entries it didn’t touch', (_, action) => {
    const next = reducer(s, { ...action, now: NOW });
    expect(next).not.toBe(s); // the action did something
    expect(next.outbox).toContain(untouched);
  });
});
