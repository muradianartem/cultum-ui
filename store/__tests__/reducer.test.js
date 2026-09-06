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

test('an unknown action is a no-op, not a crash', () => {
  const s = emptyState();
  expect(reducer(s, { type: 'nope' })).toBe(s);
});
