// When GardenProvider rebuilds the OS notification queue. The window it
// schedules is bounded (notifications/index.js), so it has to be refilled on
// resume and at local midnight, not only when the garden is edited.

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';

jest.mock('../../notifications', () => ({
  rescheduleAll: jest.fn(async () => {}),
  ensurePermission: jest.fn(async () => true),
}));
let mockPermission = 'undetermined';
jest.mock('../../prefs', () => ({
  usePrefs: () => ({
    reminderTime: '09:00',
    notificationsEnabled: true,
    notificationPermission: mockPermission,
  }),
}));

import { rescheduleAll } from '../../notifications';
import { GardenProvider, useGarden } from '../GardenProvider';
import { seedGarden } from '../testing';

const DEBOUNCE_MS = 1500;
const TICK_MS = 5 * 60 * 1000;
// Ten minutes to midnight, so two clock ticks cross into the next day.
const START = new Date(2026, 8, 5, 23, 50, 0);

let garden;
function Probe() {
  garden = useGarden();
  return null;
}

let tree;
let onAppState;
const mount = () => {
  const spy = jest.spyOn(AppState, 'addEventListener');
  const state = seedGarden({
    now: START,
    rooms: ['Kitchen'],
    plants: [
      { nickname: 'Penny', room: 'Kitchen', reminders: [{ action: 'water', intervalDays: 7, dueInDays: 1 }] },
    ],
  });
  act(() => {
    tree = TestRenderer.create(
      <GardenProvider initialState={state}>
        <Probe />
      </GardenProvider>,
    );
  });
  // Not restored: react-native's jest setup already mocks addEventListener,
  // and restoring a spy on a mock would strip its `{ remove }` return.
  onAppState = spy.mock.calls.filter(([type]) => type === 'change').at(-1)[1];
  // The mount itself schedules once.
  act(() => jest.advanceTimersByTime(DEBOUNCE_MS));
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
  rescheduleAll.mockClear();
};

beforeEach(() => {
  jest.useFakeTimers({ now: START });
  mockPermission = 'undetermined';
  jest.clearAllMocks();
  mount();
});

afterEach(() => {
  act(() => tree.unmount());
  jest.useRealTimers();
});

const settle = () => act(() => jest.advanceTimersByTime(DEBOUNCE_MS));

test('coming to the foreground rebuilds once, after the debounce', () => {
  act(() => onAppState('background'));
  act(() => onAppState('active'));
  act(() => jest.advanceTimersByTime(DEBOUNCE_MS - 1));
  expect(rescheduleAll).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
});

test('a clock tick within the same day rebuilds nothing', () => {
  act(() => jest.advanceTimersByTime(TICK_MS)); // 23:55
  settle();
  expect(rescheduleAll).not.toHaveBeenCalled();
});

test('crossing local midnight rebuilds once', () => {
  act(() => jest.advanceTimersByTime(TICK_MS)); // 23:55
  act(() => jest.advanceTimersByTime(TICK_MS)); // 00:00 the next day
  settle();
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
});

test('renaming a reminder rebuilds — the banner shows its title', () => {
  act(() => garden.updateReminder(garden.reminders[0].id, { title: 'Soak the roots' }));
  settle();
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
});

test('renaming a room rebuilds — the banner shows its name', () => {
  act(() => garden.renameRoom(garden.rooms[0].id, 'Galley'));
  settle();
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
});

test('moving a reminder’s start date rebuilds', () => {
  act(() =>
    garden.updateReminder(garden.reminders[0].id, { startAt: new Date(2026, 8, 20, 12).toISOString() }),
  );
  settle();
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
});

test('a permission granted in iOS Settings rebuilds', () => {
  mockPermission = 'granted';
  act(() => tree.update(
    <GardenProvider initialState={null}>
      <Probe />
    </GardenProvider>,
  ));
  settle();
  expect(rescheduleAll).toHaveBeenCalledTimes(1);
});
