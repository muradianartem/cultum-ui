import { emptyState } from '../model';
import { reducer } from '../reducer';

const NOW = '2026-09-05T09:00:00.000Z';

const roomDto = (id, name, extra = {}) => ({ id, name, light: 'bright', sort_order: 0, ...extra });
const plantDto = (id, nickname, roomId = null, reminders = []) => ({
  id,
  species_key: 'monstera-deliciosa',
  nickname,
  room_id: roomId,
  acquired_at: '2026-09-01',
  care: null,
  image_url: '/media/species/monstera/card.jpg',
  reminders,
});
const reminderDto = (id, plantId, extra = {}) => ({
  id,
  user_plant_id: plantId,
  type: 'watering',
  interval_days: 7,
  time_of_day: '09:00:00',
  enabled: true,
  last_done_at: null,
  ...extra,
});

const loaded = (rooms, plants, base = emptyState()) =>
  reducer(base, { type: 'garden/loaded', rooms, plants, now: NOW });

describe('loading the garden', () => {
  test('the server’s answer becomes the garden, keyed by server id', () => {
    const s = loaded(
      [roomDto('R1', 'Living Room')],
      [plantDto('P1', 'Fern', 'R1', [reminderDto('M1', 'P1')])],
    );
    expect(s.status).toBe('ready');
    expect(s.rooms).toEqual([
      { id: 'R1', name: 'Living Room', icon: 'living-room', light: 'bright', sortOrder: 0 },
    ]);
    expect(s.plants[0]).toMatchObject({ id: 'P1', nickname: 'Fern', roomId: 'R1' });
    expect(s.plants[0].heroUri).toMatch(/^https?:\/\/.+\/media\/species\/monstera\/card\.jpg$/);
    expect(s.reminders[0]).toMatchObject({
      id: 'M1',
      plantId: 'P1',
      action: 'water',
      title: 'Watering',
      timeOfDay: '09:00',
      startAt: NOW,
    });
  });

  test('three plants in a room are three plants in that room', () => {
    const s = loaded(
      [roomDto('R1', 'Living Room')],
      ['A', 'B', 'C'].map((n) => plantDto(`P${n}`, n, 'R1')),
    );
    expect(s.plants.filter((p) => p.roomId === 'R1')).toHaveLength(3);
  });

  test('anything the server no longer lists is gone', () => {
    const first = loaded([roomDto('R1', 'Kitchen')], [plantDto('P1', 'Fern', 'R1'), plantDto('P2', 'Ivy')]);
    const second = loaded([], [plantDto('P2', 'Ivy')], first);
    expect(second.rooms).toEqual([]);
    expect(second.plants.map((p) => p.id)).toEqual(['P2']);
  });

  test('device-only fields survive a reload; server fields are replaced', () => {
    let s = loaded([], [plantDto('P1', 'Fern', null, [reminderDto('M1', 'P1', { type: 'custom' })])]);
    s = reducer(s, { type: 'reminder/local', id: 'M1', patch: { title: 'Mist the leaves', action: 'mist' } });
    s = reducer(s, { type: 'plant/photo', id: 'P1', uri: 'file:///cam.jpg', file: 'photos/p1.jpg' });
    s = reducer(s, { type: 'reminder/snooze', id: 'M1', until: '2026-09-09T09:00:00.000Z' });

    s = loaded([], [plantDto('P1', 'Renamed', null, [reminderDto('M1', 'P1', { type: 'custom', interval_days: 3 })])], s);
    expect(s.plants[0]).toMatchObject({ nickname: 'Renamed', photoUri: 'file:///cam.jpg', imageFile: 'photos/p1.jpg' });
    expect(s.reminders[0]).toMatchObject({
      title: 'Mist the leaves',
      action: 'mist',
      intervalDays: 3,
      snoozedUntil: '2026-09-09T09:00:00.000Z',
    });
  });

  test('a local action that no longer matches the server’s type falls back to the server’s', () => {
    let s = loaded([], [plantDto('P1', 'Fern', null, [reminderDto('M1', 'P1', { type: 'custom' })])]);
    s = reducer(s, { type: 'reminder/local', id: 'M1', patch: { action: 'prune' } });
    s = loaded([], [plantDto('P1', 'Fern', null, [reminderDto('M1', 'P1', { type: 'fertilize' })])], s);
    expect(s.reminders[0].action).toBe('fertilize');
  });

  test('a failed first load is an error; a failed refresh keeps what the server said', () => {
    const failed = reducer(emptyState(), { type: 'garden/error', error: { code: 'offline' } });
    expect(failed.status).toBe('error');
    expect(reducer(failed, { type: 'garden/loading' }).status).toBe('loading');

    const ready = loaded([], [plantDto('P1', 'Fern')]);
    expect(reducer(ready, { type: 'garden/error', error: {} })).toBe(ready);
  });
});

describe('server responses', () => {
  const base = () => loaded([roomDto('R1', 'Kitchen')], [plantDto('P1', 'Fern', 'R1', [reminderDto('M1', 'P1')])]);

  test('an upsert adds a new row and replaces an existing one', () => {
    let s = reducer(base(), { type: 'plant/upsert', dto: plantDto('P2', 'Ivy', 'R1') });
    s = reducer(s, { type: 'plant/upsert', dto: plantDto('P1', 'Fern II', null) });
    expect(s.plants.map((p) => [p.id, p.nickname, p.roomId])).toEqual([
      ['P1', 'Fern II', null],
      ['P2', 'Ivy', 'R1'],
    ]);
    // A plant's own upsert leaves its reminders alone.
    expect(s.reminders.map((r) => r.id)).toEqual(['M1']);
  });

  test('a create’s local care fills what the response lacks', () => {
    const care = { scientific_name: 'Hedera helix', image_url: 'https://x/ivy.jpg' };
    const dto = { ...plantDto('P2', 'Ivy'), image_url: null };
    const s = reducer(base(), { type: 'plant/upsert', dto, local: { care, heroUri: 'https://x/ivy.jpg' } });
    expect(s.plants[1]).toMatchObject({ care, heroUri: 'https://x/ivy.jpg' });
  });

  test('removing a plant takes its reminders', () => {
    const s = reducer(base(), { type: 'plant/remove', id: 'P1' });
    expect(s.plants).toEqual([]);
    expect(s.reminders).toEqual([]);
  });

  test('removing a room leaves its plants roomless, as the server does', () => {
    const s = reducer(base(), { type: 'room/remove', id: 'R1' });
    expect(s.rooms).toEqual([]);
    expect(s.plants[0].roomId).toBeNull();
  });

  test('a reminder upsert carries the device-only fields it is given', () => {
    const s = reducer(base(), {
      type: 'reminder/upsert',
      dto: reminderDto('M2', 'P1', { type: 'custom' }),
      local: { action: 'rotate', title: 'Turn the pot', startAt: '2026-09-10T12:00:00.000Z' },
      now: NOW,
    });
    expect(s.reminders[1]).toMatchObject({
      id: 'M2',
      plantId: 'P1',
      action: 'rotate',
      title: 'Turn the pot',
      startAt: '2026-09-10T12:00:00.000Z',
    });
  });

  test('removals of unknown ids change nothing', () => {
    const s = base();
    expect(reducer(s, { type: 'plant/remove', id: 'nope' })).toBe(s);
    expect(reducer(s, { type: 'room/remove', id: 'nope' })).toBe(s);
    expect(reducer(s, { type: 'reminder/remove', id: 'nope' })).toBe(s);
  });
});

describe('completions and their undo', () => {
  const base = () => loaded([], [plantDto('P1', 'Fern', null, [reminderDto('M1', 'P1')])]);

  test('complete stamps lastDoneAt and spends a snooze; restore puts both back', () => {
    let s = reducer(base(), { type: 'reminder/snooze', id: 'M1', until: '2026-09-07T09:00:00.000Z' });
    const before = s.reminders[0];
    s = reducer(s, { type: 'reminder/complete', id: 'M1', now: NOW });
    expect(s.reminders[0]).toMatchObject({ lastDoneAt: NOW, snoozedUntil: null });

    s = reducer(s, {
      type: 'reminders/restore',
      entries: [{ id: 'M1', lastDoneAt: before.lastDoneAt, snoozedUntil: before.snoozedUntil }],
    });
    expect(s.reminders[0]).toEqual(before);
  });

  test('the server’s completion does not move a later local one backwards', () => {
    let s = reducer(base(), { type: 'reminder/complete', id: 'M1', at: '2026-09-05T10:00:00.000Z' });
    s = reducer(s, {
      type: 'reminder/upsert',
      dto: reminderDto('M1', 'P1', { last_done_at: '2026-09-05T09:59:00.000Z' }),
    });
    expect(s.reminders[0].lastDoneAt).toBe('2026-09-05T10:00:00.000Z');
  });
});
