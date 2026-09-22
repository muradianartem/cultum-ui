import { MAX_SCHEDULED, cancelAll, pendingOccurrences, rescheduleAll } from '../index';
import { seedGarden } from '../../store/testing';

const NOW = new Date(2026, 8, 5, 11, 0, 0);

const Notifications = require('expo-notifications');

beforeEach(() => jest.clearAllMocks());

test('only schedules what is still ahead — the past is already on screen', () => {
  const garden = seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        room: 'Kitchen',
        reminders: [
          { action: 'water', intervalDays: 7, dueInDays: -2 }, // overdue
          { action: 'mist', intervalDays: 30, dueInDays: 3 },
        ],
      },
    ],
  });
  // Nothing in the past is scheduled — an overdue task is already sitting on
  // the Today screen, and a notification for it would fire the instant it was
  // set. Its future repeats still schedule normally.
  const due = pendingOccurrences(garden, NOW);
  expect(due.every((t) => new Date(t.dueAt) > NOW)).toBe(true);
  expect(due.map((t) => t.title)).toEqual(expect.arrayContaining(['Misting', 'Watering']));
});

test('stays inside the platform budget, keeping the soonest', () => {
  // A dozen plants misting daily would want hundreds of notifications.
  const garden = seedGarden({
    now: NOW,
    plants: Array.from({ length: 12 }, (_, i) => ({
      nickname: `Plant ${i}`,
      room: 'Kitchen',
      reminders: [{ action: 'mist', intervalDays: 1, dueInDays: 1 }],
    })),
  });

  const due = pendingOccurrences(garden, NOW);
  expect(due).toHaveLength(MAX_SCHEDULED);
  expect(MAX_SCHEDULED).toBeLessThan(64); // iOS's hard cap
  // Soonest first, so what gets dropped is the far future.
  const dates = due.map((t) => new Date(t.dueAt).getTime());
  expect([...dates].sort((a, b) => a - b)).toEqual(dates);
});

test('a disabled reminder and an archived plant schedule nothing', () => {
  const garden = seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Off',
        room: 'Kitchen',
        reminders: [{ action: 'water', enabled: false, dueInDays: 1 }],
      },
      {
        nickname: 'Gone',
        room: 'Kitchen',
        archived: true,
        reminders: [{ action: 'water', dueInDays: 1 }],
      },
    ],
  });
  expect(pendingOccurrences(garden, NOW)).toEqual([]);
});

test('the banner reads as an instruction, and says which plant and room', async () => {
  const garden = seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        room: 'Kitchen',
        reminders: [{ action: 'water', intervalDays: 7, dueInDays: 2 }],
      },
    ],
  });

  await rescheduleAll(garden, NOW);

  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  // A weekly reminder produces one notification per occurrence across the
  // horizon, soonest first — this asserts on the next one.
  expect(Notifications.scheduleNotificationAsync.mock.calls.length).toBeGreaterThan(1);
  const [{ content, trigger }] = Notifications.scheduleNotificationAsync.mock.calls[0];
  expect(content.title).toBe('Water Penny');
  expect(content.body).toBe('Watering · Kitchen');
  expect(content.data).toEqual({
    plantId: garden.plants[0].id,
    reminderId: garden.reminders[0].id,
  });
  expect(trigger.type).toBe('date');
  expect(trigger.date).toBeInstanceOf(Date);
});

test('a custom reminder keeps the name the user gave it', async () => {
  const garden = seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Figgy',
        room: 'Bedroom',
        reminders: [
          { action: 'custom', title: 'Check for better pods', intervalDays: 7, dueInDays: 1 },
        ],
      },
    ],
  });

  await rescheduleAll(garden, NOW);
  const [{ content }] = Notifications.scheduleNotificationAsync.mock.calls[0];
  expect(content.title).toBe('Check for better pods');
  expect(content.body).toBe('Figgy · Bedroom');
});

test('rebuilding always starts from a clean slate', async () => {
  await rescheduleAll(seedGarden({ now: NOW }), NOW);
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

describe('the master switch', () => {
  // A garden with something genuinely schedulable, so "nothing was scheduled"
  // means the switch did it rather than there having been nothing to do.
  const garden = () =>
    seedGarden({
      now: NOW,
      plants: [
        {
          nickname: 'Penny',
          room: 'Kitchen',
          reminders: [{ action: 'water', intervalDays: 7, dueInDays: 1 }],
        },
      ],
    });

  beforeEach(() => {
    Notifications.cancelAllScheduledNotificationsAsync.mockClear();
    Notifications.scheduleNotificationAsync.mockClear();
  });

  test('off still clears the queue, but schedules nothing', async () => {
    await rescheduleAll(garden(), NOW, { notificationsEnabled: false });
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('on is the default, so every existing caller is unaffected', async () => {
    await rescheduleAll(garden(), NOW);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });
});

describe('cancelAll on sign-out', () => {
  // Three schedulable occurrences, so a rebuild has a loop to be caught in.
  const garden = () =>
    seedGarden({
      now: NOW,
      plants: [
        {
          nickname: 'Penny',
          room: 'Kitchen',
          reminders: [{ action: 'water', intervalDays: 20, dueInDays: 1 }],
        },
      ],
    });

  // Every scheduleNotificationAsync waits until the test releases it.
  const gateSchedules = () => {
    const releases = [];
    Notifications.scheduleNotificationAsync.mockImplementation(
      () => new Promise((resolve) => releases.push(resolve)),
    );
    return async () => {
      while (releases.length) releases.shift()();
      await new Promise((r) => setImmediate(r));
    };
  };
  const flush = () => new Promise((r) => setImmediate(r));
  // Every call to either mock, in the order they happened.
  const calls = () =>
    [
      ...Notifications.scheduleNotificationAsync.mock.invocationCallOrder.map((o) => [o, 'schedule']),
      ...Notifications.cancelAllScheduledNotificationsAsync.mock.invocationCallOrder.map((o) => [o, 'cancel']),
    ]
      .sort((a, b) => a[0] - b[0])
      .map(([, name]) => name);

  afterEach(() => Notifications.scheduleNotificationAsync.mockImplementation(async () => 'id'));

  test('stops a rebuild in flight, and the queue ends empty', async () => {
    const release = gateSchedules();
    const rebuilding = rescheduleAll(garden(), NOW);
    await flush(); // cancel → first schedule is now pending
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    const cancelling = cancelAll();
    // Let the pending schedule land, as the OS would.
    for (let i = 0; i < 5; i++) await release();
    await Promise.all([rebuilding, cancelling]);

    // The rebuild noticed and stopped after the one call already in flight...
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    // ...and the last word went to the sign-out's cancel.
    expect(calls().at(-1)).toBe('cancel');
  });

  test('a request queued before the sign-out never runs', async () => {
    const release = gateSchedules();
    const first = rescheduleAll(garden(), NOW);
    await flush();
    const queued = rescheduleAll(garden(), NOW); // queued behind the first
    const cancelling = cancelAll();
    for (let i = 0; i < 5; i++) await release();
    await Promise.all([first, queued, cancelling]);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(calls().at(-1)).toBe('cancel');
  });

  test('a rebuild after the sign-out works normally', async () => {
    await cancelAll();
    Notifications.scheduleNotificationAsync.mockClear();
    Notifications.scheduleNotificationAsync.mockImplementation(async () => 'id');
    await rescheduleAll(garden(), NOW);
    expect(Notifications.scheduleNotificationAsync.mock.calls.length).toBeGreaterThan(1);
  });
});
