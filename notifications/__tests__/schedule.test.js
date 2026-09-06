import { MAX_SCHEDULED, pendingOccurrences, rescheduleAll } from '../index';
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
