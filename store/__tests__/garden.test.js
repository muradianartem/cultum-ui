// GardenProvider against a server: every change is a request, only the
// response lands in the store, and a relaunch shows exactly what the server
// has. The regression this guards: three plants added to a room, and the room
// later showing one.

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';

jest.mock('../../notifications', () => ({
  rescheduleAll: jest.fn(async () => {}),
  ensurePermission: jest.fn(async () => true),
}));
jest.mock('../../prefs', () => ({
  usePrefs: () => ({ reminderTime: '09:00', notificationsEnabled: true, notificationPermission: 'granted' }),
}));
jest.mock('../../lib/showError', () => ({
  showError: jest.fn(),
  errorMessage: () => 'failed',
}));

import { rescheduleAll } from '../../notifications';
import { showError } from '../../lib/showError';
import { GardenProvider, useGarden } from '../GardenProvider';
import { clearState, loadState } from '../persist';
import { fakeGardenApi, seedGarden } from '../testing';
import { roomCard } from '../views';

const NOW = new Date(2026, 8, 5, 10, 0, 0);
const offline = () => Object.assign(new Error('Network request failed'), { code: 'offline', status: 0 });

let garden;
function Probe() {
  garden = useGarden();
  return null;
}

const trees = [];
async function launch(api) {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <GardenProvider api={api} clock={NOW}>
        <Probe />
      </GardenProvider>,
    );
  });
  await settle();
  trees.push(tree);
  return tree;
}

/** Let the fake server's answers, and the effects they cause, all land. */
async function settle() {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function quit(tree) {
  await act(async () => tree.unmount());
  trees.splice(trees.indexOf(tree), 1);
}

const addPlant = (nickname, roomId, reminders = []) =>
  garden.addPlant({ speciesKey: 'monstera-deliciosa', nickname, roomId, reminders });

beforeEach(async () => {
  await clearState();
  jest.clearAllMocks();
});
afterEach(async () => {
  while (trees.length) await quit(trees[0]);
});

describe('three plants in the Living Room', () => {
  test('stay three plants across a relaunch, and the room says so', async () => {
    const server = fakeGardenApi();
    const first = await launch(server);
    expect(garden.status).toBe('ready');

    let roomId;
    await act(async () => {
      roomId = await garden.addRoom('Living Room');
      await addPlant('Fern', roomId);
      await addPlant('Ivy', roomId);
      await addPlant('Pothos', roomId);
    });
    expect(garden.plantsInRoom(roomId)).toHaveLength(3);
    // Every one of them went to the server, into that room.
    expect(server.callsTo('addPlant').map(([p]) => p.roomId)).toEqual([roomId, roomId, roomId]);
    expect(server.listRooms).toBeDefined();

    await quit(first);
    await launch(server);

    expect(garden.plantsInRoom(roomId).map((p) => p.nickname)).toEqual(['Fern', 'Ivy', 'Pothos']);
    expect(roomCard(garden.state, garden.getRoom(roomId), NOW).meta).toMatch(/^3 plants/);
  });

  test('a refresh that raced an add cannot drop the new plant', async () => {
    const server = fakeGardenApi();
    await launch(server);
    let roomId;
    await act(async () => {
      roomId = await garden.addRoom('Living Room');
    });

    // The GET leaves before the POST and answers after it: the old list.
    const listed = server.getGarden;
    let release;
    server.getGarden = async () => {
      const snapshot = await listed();
      await new Promise((resolve) => {
        release = resolve;
      });
      return snapshot;
    };
    let refreshed;
    await act(async () => {
      refreshed = garden.refresh();
      await Promise.resolve();
    });
    await act(async () => {
      await addPlant('Fern', roomId);
    });
    server.getGarden = listed; // the retry reads the current garden
    await act(async () => {
      release();
      await refreshed;
    });
    await settle();

    expect(garden.plantsInRoom(roomId).map((p) => p.nickname)).toEqual(['Fern']);
  });
});

describe('a change the server refuses', () => {
  test.each([
    ['a validation error', Object.assign(new Error('422'), { status: 422, code: 'http' })],
    ['the plan limit', Object.assign(new Error('403'), { status: 403, code: 'unauthorized' })],
    ['no connection', offline()],
  ])('%s rejects and adds nothing', async (_, error) => {
    const server = fakeGardenApi();
    await launch(server);
    server.fail('addPlant', error);

    let caught = null;
    await act(async () => {
      await addPlant('Fern', null).catch((e) => {
        caught = e;
      });
    });
    expect(caught).toBe(error);
    expect(garden.plants).toEqual([]);
    expect(server.plants.size).toBe(0);
  });

  test('a plant created but a reminder refused: the plant stays and the error names it', async () => {
    const server = fakeGardenApi();
    await launch(server);
    server.fail('createReminder', offline());

    let caught = null;
    await act(async () => {
      await addPlant('Fern', null, [{ action: 'water', intervalDays: 7 }]).catch((e) => {
        caught = e;
      });
    });
    expect(caught.plantId).toBe(garden.plants[0].id);
    expect(garden.reminders).toEqual([]);
  });

  test('a delete the server refuses leaves the plant where it was', async () => {
    const server = fakeGardenApi(seedGarden({ now: NOW, plants: [{ nickname: 'Fern', room: 'Kitchen' }] }));
    await launch(server);
    const [plant] = garden.plants;
    server.fail('removePlant', offline());

    await act(async () => {
      await garden.deletePlant(plant.id).catch(() => {});
    });
    expect(garden.plants.map((p) => p.id)).toEqual([plant.id]);
  });
});

describe('launch', () => {
  test('shows nothing until the server answers, and an error when it can’t', async () => {
    const server = fakeGardenApi(seedGarden({ now: NOW, plants: [{ nickname: 'Fern' }] }));
    server.fail('getGarden', offline());
    await launch(server);
    expect(garden.status).toBe('error');
    expect(garden.ready).toBe(false);

    await act(async () => {
      await garden.retry();
    });
    expect(garden.status).toBe('ready');
    expect(garden.plants.map((p) => p.nickname)).toEqual(['Fern']);
  });

  test('offline, notifications are rebuilt from the last answer, never from nothing', async () => {
    jest.useFakeTimers();
    try {
      const server = fakeGardenApi(
        seedGarden({ now: NOW, plants: [{ nickname: 'Fern', reminders: [{ action: 'water', dueInDays: 2 }] }] }),
      );
      const first = await launch(server);
      await act(async () => jest.advanceTimersByTime(2000));
      await quit(first);
      jest.advanceTimersByTime(1000); // the mirror's debounced write
      expect((await loadState()).reminders).toHaveLength(1);

      rescheduleAll.mockClear();
      server.fail('listRooms', offline());
      await launch(server);
      await act(async () => jest.advanceTimersByTime(2000));

      expect(garden.status).toBe('error');
      expect(rescheduleAll).toHaveBeenCalled();
      for (const [state] of rescheduleAll.mock.calls) expect(state.reminders).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('completing a task', () => {
  const withTask = () =>
    fakeGardenApi(
      seedGarden({ now: NOW, plants: [{ nickname: 'Fern', reminders: [{ action: 'water', dueInDays: 0 }] }] }),
    );

  test('an undo sends nothing; a lapsed offer sends the completion', async () => {
    const server = withTask();
    await launch(server);
    const id = garden.reminders[0].id;

    let token;
    act(() => {
      token = garden.completeReminder(id);
    });
    expect(garden.reminders[0].lastDoneAt).not.toBeNull();
    act(() => token.undo());
    await settle();
    expect(server.callsTo('completeReminder')).toEqual([]);
    expect(garden.todaysTasks).toHaveLength(1);

    act(() => {
      token = garden.completeReminder(id);
    });
    act(() => token.drop());
    await settle();
    expect(server.callsTo('completeReminder')).toEqual([[id]]);
    expect(server.reminders.get(id).last_done_at).not.toBeNull();
  });

  test('a completion the server refuses is taken back, and the user is told', async () => {
    const server = withTask();
    await launch(server);
    const id = garden.reminders[0].id;
    server.fail('completeReminder', offline());

    let token;
    act(() => {
      token = garden.completeReminder(id);
    });
    act(() => token.drop());
    await settle();
    expect(garden.todaysTasks).toHaveLength(1);
    expect(showError).toHaveBeenCalled();
  });

  test('going to the background sends a completion still waiting on its undo', async () => {
    const spy = jest.spyOn(AppState, 'addEventListener');
    const server = withTask();
    await launch(server);
    const onAppState = spy.mock.calls.filter(([type]) => type === 'change').at(-1)[1];
    const id = garden.reminders[0].id;

    act(() => {
      garden.completeReminder(id);
    });
    act(() => onAppState('background'));
    await settle();
    expect(server.callsTo('completeReminder')).toEqual([[id]]);
  });
});
