// The sync hold behind the snackbar's Undo.
//
// The backend has no un-complete endpoint, so a completion that reaches it can
// never be taken back — and the outbox drains 2s after a mutation, well inside
// the 5s the bar is up. These tests pin the rule that makes Undo honest: while
// an undo token is alive, nothing pushes.

import TestRenderer, { act } from 'react-test-renderer';
import { GardenProvider, useGarden } from '../GardenProvider';
import { seedGarden } from '../testing';
import { syncGarden } from '../sync';

// Without a session `runSync` returns early — as it does in every other test in
// this repo, which is exactly why the hold needs its own file.
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ status: 'signedIn', devSession: false }),
}));
// Returning null means no `sync/apply`, so a sync can’t feed the next one.
jest.mock('../sync', () => ({ syncGarden: jest.fn(async () => null) }));

jest.useFakeTimers();

const NOW = new Date(2026, 8, 5, 15, 0, 0);
const SYNC_MS = 2000;

/** Mount a bare store with a handle on its actions and current state. */
function mountGarden() {
  const state = seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        reminders: [
          { action: 'water', intervalDays: 7, dueInDays: 0 },
          { action: 'mist', intervalDays: 3, dueInDays: 0 },
        ],
      },
    ],
  });
  // seedGarden builds local rows; a push only happens for synced ones.
  const synced = {
    ...state,
    plants: state.plants.map((p, i) => ({ ...p, serverId: `S${i + 1}` })),
    reminders: state.reminders.map((r, i) => ({ ...r, serverId: `R${i + 1}` })),
  };

  const api = {};
  function Probe() {
    Object.assign(api, useGarden());
    return null;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(
      <GardenProvider initialState={synced} clock={NOW}>
        <Probe />
      </GardenProvider>,
    );
  });
  return { tree, api, ids: synced.reminders.map((r) => r.id) };
}

// Async so the awaited promise inside `runSync` settles before the next
// assertion — a sync `act` would leave `syncing` latched and swallow the
// following drain.
const advance = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const pushed = () => syncGarden.mock.calls.map(([s]) => s);

beforeEach(() => {
  syncGarden.mockClear();
});

test('an open undo keeps the completion off the server', async () => {
  const { tree, api } = mountGarden();
  let token;
  act(() => {
    token = api.completeReminder(api.todaysTasks[0].reminderId);
  });

  await advance(SYNC_MS * 3);
  expect(syncGarden).not.toHaveBeenCalled();

  // Letting the bar time out is what finally releases it.
  act(() => token.drop());
  await advance(SYNC_MS);
  expect(syncGarden).toHaveBeenCalledTimes(1);
  expect(pushed()[0].outbox.map((e) => e.op)).toContain('reminder.complete');

  act(() => tree.unmount());
});

test('undoing takes the queued completion with it — nothing is ever pushed', async () => {
  const { tree, api } = mountGarden();
  const task = api.todaysTasks[0];
  const before = api.state.reminders.find((r) => r.id === task.reminderId).lastDoneAt;

  let token;
  act(() => {
    token = api.completeReminder(task.reminderId);
  });
  await advance(SYNC_MS + 500); // the drain would have fired by now
  act(() => token.undo());
  await advance(SYNC_MS * 3);

  expect(syncGarden).toHaveBeenCalledTimes(1); // the release's own sync
  expect(pushed()[0].outbox.map((e) => e.op)).not.toContain('reminder.complete');
  expect(pushed()[0].reminders.find((r) => r.id === task.reminderId).lastDoneAt).toBe(before);
  // And the task is back on the list.
  expect(api.todaysTasks.map((t) => t.reminderId)).toContain(task.reminderId);

  act(() => tree.unmount());
});

test('two undos in a row hold the queue until both are retired', async () => {
  const { tree, api } = mountGarden();
  const [first, second] = api.todaysTasks.map((t) => t.reminderId);

  let a;
  let b;
  act(() => {
    a = api.completeReminder(first);
  });
  act(() => {
    b = api.completeReminder(second);
  });

  act(() => a.drop());
  await advance(SYNC_MS * 2);
  expect(syncGarden).not.toHaveBeenCalled(); // b still holds it

  act(() => b.drop());
  await advance(SYNC_MS);
  expect(syncGarden).toHaveBeenCalledTimes(1);

  act(() => tree.unmount());
});

test('a token is spent once — undo twice, or undo then drop, is one release', async () => {
  const { tree, api } = mountGarden();
  const task = api.todaysTasks[0];
  const before = api.state.reminders.find((r) => r.id === task.reminderId).lastDoneAt;

  let token;
  act(() => {
    token = api.completeReminder(task.reminderId);
  });
  act(() => {
    token.undo();
    token.undo();
    token.drop();
  });
  await advance(SYNC_MS * 2);

  // One release: the hold is back to zero (a sync ran) and not below it — a
  // second decrement would leave the next hold unable to stop anything.
  expect(syncGarden).toHaveBeenCalledTimes(1);
  expect(api.state.reminders.find((r) => r.id === task.reminderId).lastDoneAt).toBe(before);

  let next;
  act(() => {
    next = api.completeReminder(task.reminderId);
  });
  await advance(SYNC_MS * 2);
  expect(syncGarden).toHaveBeenCalledTimes(1); // still held

  act(() => next.drop());
  await advance(SYNC_MS);
  expect(syncGarden).toHaveBeenCalledTimes(2);

  act(() => tree.unmount());
});

test('completing nothing hands back no token', async () => {
  const { tree, api } = mountGarden();
  let token;
  act(() => {
    token = api.completeReminders([]);
  });
  expect(token).toBeNull();

  act(() => tree.unmount());
});
