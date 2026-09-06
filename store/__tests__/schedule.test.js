import { emptyState, makePlant, makeReminder } from '../model';
import {
  addDays,
  dueLabel,
  nextDueAt,
  occurrenceAfter,
  plantTasks,
  todayTasks,
  upcomingTasks,
} from '../schedule';

// A fixed clock, mid-morning, so a 09:00 reminder that is "due today" has
// already come due rather than sitting an hour in the future.
const NOW = new Date(2026, 8, 5, 11, 0, 0); // Sat 5 Sep 2026

function garden({ reminders = [], roomId = 'kitchen', archived = false } = {}) {
  const base = emptyState();
  const plant = { ...makePlant({ speciesKey: 'monstera', nickname: 'Penny', roomId }), archived };
  return {
    ...base,
    plants: [plant],
    // Anchored to the fixed clock, not the wall clock, so a reminder with no
    // explicit start doesn't drift out of the day the test is reasoning about.
    reminders: reminders.map((r) => ({
      ...makeReminder({ plantId: plant.id, now: NOW, ...r }),
      ...r,
    })),
    plant,
  };
}

describe('nextDueAt', () => {
  test('a fresh reminder opens on its start date, at its time of day', () => {
    const r = makeReminder({ plantId: 'p', startAt: new Date(2026, 8, 5).toISOString() });
    expect(nextDueAt(r)).toEqual(new Date(2026, 8, 5, 9, 0));
  });

  test('once completed it runs from the completion, not the start', () => {
    const r = {
      ...makeReminder({ plantId: 'p', intervalDays: 6 }),
      startAt: new Date(2026, 0, 1).toISOString(),
      lastDoneAt: new Date(2026, 8, 1, 18, 30).toISOString(),
    };
    expect(nextDueAt(r)).toEqual(new Date(2026, 8, 7, 9, 0));
  });

  test('a snooze pushes the occurrence out, but only while it is still later', () => {
    const base = {
      ...makeReminder({ plantId: 'p', intervalDays: 7 }),
      lastDoneAt: new Date(2026, 8, 1).toISOString(),
    };
    const later = new Date(2026, 8, 10, 9, 0).toISOString();
    expect(nextDueAt({ ...base, snoozedUntil: later })).toEqual(new Date(later));

    // A snooze that has been overtaken by the natural date is spent.
    const earlier = new Date(2026, 8, 2).toISOString();
    expect(nextDueAt({ ...base, snoozedUntil: earlier })).toEqual(new Date(2026, 8, 8, 9, 0));
  });

  test('a zero or missing interval can never produce a stuck schedule', () => {
    const r = { ...makeReminder({ plantId: 'p' }), intervalDays: 0, lastDoneAt: NOW.toISOString() };
    expect(nextDueAt(r)).toEqual(new Date(2026, 8, 6, 9, 0));
  });
});

describe('occurrenceAfter', () => {
  test('steps the cadence rather than re-anchoring to the cursor', () => {
    const r = {
      ...makeReminder({ plantId: 'p', intervalDays: 6 }),
      lastDoneAt: new Date(2026, 8, 1).toISOString(),
    };
    // Due 7 Sep; the next one after 8 Sep is 13 Sep, not 14 (8 + 6).
    expect(occurrenceAfter(r, new Date(2026, 8, 8, 23, 59))).toEqual(new Date(2026, 8, 13, 9, 0));
  });
});

describe('dueLabel', () => {
  test.each([
    [0, 'Today'],
    [1, 'Tomorrow'],
    [5, 'In 5d'],
    [-3, '3d ago'],
  ])('%i days out reads as %s', (offset, expected) => {
    expect(dueLabel(addDays(NOW, offset), NOW)).toBe(expected);
  });
});

describe('todayTasks', () => {
  test('collects what is due today and what was missed, overdue first', () => {
    const g = garden({
      reminders: [
        { action: 'water', intervalDays: 7, lastDoneAt: new Date(2026, 7, 29).toISOString() }, // due today
        { action: 'fertilize', intervalDays: 30, lastDoneAt: new Date(2026, 7, 1).toISOString() }, // overdue
        { action: 'mist', intervalDays: 3, lastDoneAt: NOW.toISOString() }, // future
      ],
    });
    const tasks = todayTasks(g, NOW);
    expect(tasks.map((t) => [t.title, t.due])).toEqual([
      ['Fertilizing', '5d ago'],
      ['Watering', 'Today'],
    ]);
    expect(tasks[0]).toMatchObject({ plant: 'Penny', room: 'Kitchen', overdue: true });
  });

  test('a disabled reminder produces nothing', () => {
    const g = garden({ reminders: [{ action: 'water', enabled: false, intervalDays: 1 }] });
    expect(todayTasks(g, NOW)).toEqual([]);
  });

  test('an archived plant drops out of the day entirely', () => {
    const g = garden({
      archived: true,
      reminders: [{ action: 'water', intervalDays: 1, lastDoneAt: new Date(2026, 7, 1).toISOString() }],
    });
    expect(todayTasks(g, NOW)).toEqual([]);
    expect(plantTasks(g, g.plant.id, NOW)).toEqual([]);
  });

  test('a plant with no room still reads sensibly', () => {
    const g = garden({ roomId: null, reminders: [{ action: 'water', intervalDays: 7 }] });
    expect(todayTasks(g, NOW)[0].room).toBe('No room');
  });
});

describe('upcomingTasks', () => {
  test('repeats across the horizon instead of showing only the next one', () => {
    const g = garden({
      reminders: [{ action: 'water', intervalDays: 7, lastDoneAt: NOW.toISOString() }],
    });
    const dates = upcomingTasks(g, NOW, 30).map((t) => new Date(t.dueAt).getDate());
    expect(dates).toEqual([12, 19, 26, 3]); // 12/19/26 Sep, then 3 Oct
  });

  test('nothing due today leaks into upcoming, and vice versa', () => {
    const g = garden({
      reminders: [{ action: 'water', intervalDays: 7, lastDoneAt: new Date(2026, 7, 29).toISOString() }],
    });
    expect(todayTasks(g, NOW)).toHaveLength(1);
    expect(upcomingTasks(g, NOW, 10).every((t) => new Date(t.dueAt) > NOW)).toBe(true);
    expect(upcomingTasks(g, NOW, 10).map((t) => t.due)).toEqual(['In 7d']);
  });
});
