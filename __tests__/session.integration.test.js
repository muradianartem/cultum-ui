// The session end to end: the real AuthProvider, api/client, GardenProvider and
// App.js's AuthGate, with only the network, SecureStore, connectivity and the
// filesystem faked (test/support/integration.js).
//
// Each layer has unit tests that mock its neighbour, and that is exactly how
// the refresh recursion (spec 01) and the offline sign-out (spec 04) shipped:
// no test ever had AuthProvider minting a token through the same apiFetch that
// was asking it for one. These scenarios do.

import { act } from 'react-test-renderer';
import {
  advance,
  authStore,
  cleanup,
  createServer,
  deferred,
  idToken,
  json,
  net,
  renderApp,
  savedEntitlement,
  savedGarden,
  session,
  writeGarden,
} from '../test/support/integration';
import { seedGarden } from '../store/testing';
import { enqueue } from '../store/outbox';

jest.mock('../lib/authStorage', () => require('../test/support/integration').fakeAuthStorage);
jest.mock('../lib/net', () => require('../test/support/integration').net);

const Notifications = require('expo-notifications');

// Midday, so a 09:00 reminder due today has already come due and is on Today.
const NOW = new Date(2026, 8, 21, 12, 0, 0);

// GardenProvider's debounces, with a little room: sync 2000, save 400,
// reschedule 1500, media 1200.
const SETTLE_MS = 2500;

const reminderDto = (id, plantId) => ({
  id,
  user_plant_id: plantId,
  type: 'watering',
  interval_days: 7,
  time_of_day: '09:00:00',
  enabled: true,
  last_done_at: null,
});
const plantDto = (id, nickname) => ({
  id,
  species_key: 'monstera-deliciosa',
  nickname,
  room_id: null,
  acquired_at: '2026-08-01',
  care: null,
  reminders: [reminderDto(`R-${id}`, id)],
});
const entitlementDto = (isPlus) => ({
  plan: isPlus ? 'plus' : 'free',
  is_plus: isPlus,
  limits: {},
  usage: null,
  subscription: null,
});

let server;

// Today names a task's plant inside a longer line ("Penny · Kitchen").
const onScreen = (app, text) => app.texts().some((t) => typeof t === 'string' && t.includes(text));

// Two users. Each bearer is one user's; an unknown one is a 401, as it would be.
const USERS = {
  A1: 'a',
  A2: 'a',
  B1: 'b',
};
function serve({ gardens, entitlements }) {
  server = createServer();
  global.fetch = server.fetch;
  const who = (req) => USERS[req.bearer];
  const authed = (fn) => (req) => (who(req) ? fn(req, who(req)) : json({ detail: 'Not authenticated' }, 401));
  server.route('GET', '/users/me/rooms', authed(() => []));
  server.route('GET', '/users/me/plants', authed((req, user) => gardens[user]()));
  server.route('GET', '/users/me/subscription', authed((req, user) => entitlements[user]));
  server.route('POST', '/auth/logout', () => null);
  return server;
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  Notifications.scheduleNotificationAsync.mockClear();
  Notifications.cancelAllScheduledNotificationsAsync.mockClear();
});

afterEach(async () => {
  cleanup();
  // Let anything the unmount kicked off (a flush, a cancelAll) finish here
  // rather than in the next test.
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Guards 01: /auth/refresh used to go through getAuthToken, which found the
// stored token expired and started the very rotation already in flight — the
// recursion blew the stack and was read as a rejected refresh token.
test('cold launch with an expired token, online: one refresh, then sync on the new bearer', async () => {
  authStore.tokens = session('A0', 'rA1', { expiresInMs: -60 * 1000 });
  serve({
    gardens: { a: () => [plantDto('SA1', 'Alpha Fern')] },
    entitlements: { a: entitlementDto(false) },
  });
  server.route('POST', '/auth/refresh', (req) =>
    req.body?.refresh_token === 'rA1'
      ? { access_token: 'A2', refresh_token: 'rA2', token_type: 'bearer', expires_in: 3600 }
      : json({ detail: 'Invalid or expired refresh token' }, 401),
  );

  const app = await renderApp();
  await advance(SETTLE_MS);

  expect(server.requests('POST', '/auth/refresh')).toHaveLength(1);
  expect(app.auth.status).toBe('signedIn');
  expect(authStore.tokens).toMatchObject({ access_token: 'A2', refresh_token: 'rA2' });
  // The garden went out on the rotated bearer, never on the expired one.
  expect(server.requests('GET', '/users/me/plants', 'A2').length).toBeGreaterThan(0);
  expect(server.requests('GET', '/users/me/plants', 'A0')).toHaveLength(0);
  expect(onScreen(app, 'Alpha Fern')).toBe(true);
  await advance(SETTLE_MS); // the save debounce, after the round landed
  expect(savedGarden().plants.map((p) => p.serverId)).toEqual(['SA1']);
});

// Guards 04: a refresh that fails because the radio is off used to end the
// session, and AuthGate's sign-out cleanup then wiped the garden and its queue.
test('cold launch with an expired token, offline: still signed in, garden and outbox intact', async () => {
  authStore.tokens = session('A0', 'rA1', { expiresInMs: -60 * 1000 });
  const doc = seedGarden({
    now: NOW,
    plants: [
      { nickname: 'Offline Olive', room: 'Kitchen', reminders: [{ action: 'water', dueInDays: 0 }] },
    ],
  });
  const olive = doc.plants[0];
  writeGarden({ ...doc, outbox: enqueue([], 'plant.create', olive.id) });
  serve({ gardens: { a: () => [] }, entitlements: { a: entitlementDto(false) } });
  server.offline = true;
  net.offline = true;

  const app = await renderApp();
  await advance(SETTLE_MS);

  expect(app.auth.status).toBe('signedIn');
  expect(authStore.tokens).toMatchObject({ refresh_token: 'rA1' });
  expect(onScreen(app, 'Offline Olive')).toBe(true);
  expect(savedGarden().outbox).toEqual([expect.objectContaining({ op: 'plant.create', localId: olive.id })]);
});

// Guards the sign-out path as a whole: AuthGate's cleanup (dropping any one of
// clearState, cancelAll or clearEntitlement fails this), and a pull still in
// flight for the previous user never landing in the next one's garden.
test('switching accounts leaves nothing of the first one behind', async () => {
  // A is signed in with a synced plant, Plus, and a reminder queued with the OS.
  authStore.tokens = session('A1', 'rA1');
  const docA = seedGarden({
    now: NOW,
    plants: [{ nickname: 'Alpha Fern', room: 'Kitchen', reminders: [{ action: 'water', dueInDays: 1 }] }],
  });
  writeGarden({
    ...docA,
    rooms: docA.rooms.map((r) => ({ ...r, serverId: 'RM-A' })),
    plants: docA.plants.map((p) => ({ ...p, serverId: 'SA1' })),
    reminders: docA.reminders.map((r) => ({ ...r, serverId: 'R-SA1' })),
  });
  require('expo-file-system').__files.set(
    'file:///documents/cultum-entitlement.json',
    JSON.stringify(entitlementDto(true)),
  );
  const pullA = deferred();
  serve({
    gardens: { a: () => pullA.promise, b: () => [plantDto('SB1', 'Bravo Cactus')] },
    entitlements: { a: entitlementDto(true), b: entitlementDto(false) },
  });
  server.route('POST', '/auth/google', () => ({
    access_token: 'B1',
    refresh_token: 'rB1',
    token_type: 'bearer',
    expires_in: 3600,
  }));

  const app = await renderApp();
  await advance(SETTLE_MS); // A's reminder is scheduled; A's pull is now hanging
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  expect(server.requests('GET', '/users/me/plants', 'A1')).toHaveLength(1);

  await act(async () => {
    await app.auth.signOut();
  });
  await advance(0);
  expect(app.auth.status).toBe('signedOut');
  // Signed out, nothing of A's account is left: not the plan...
  expect(savedEntitlement()).toBeNull();
  // ...and not the OS's queue — the last word went to a cancel.
  const lastOrder = (fn) => Math.max(0, ...fn.mock.invocationCallOrder);
  expect(lastOrder(Notifications.cancelAllScheduledNotificationsAsync)).toBeGreaterThan(
    lastOrder(Notifications.scheduleNotificationAsync),
  );

  await act(async () => {
    await app.auth.completeGoogleLogin(idToken({ given_name: 'Bea', email: 'bea@example.com' }));
  });
  await advance(0);
  // B's garden before B's own pull: whatever is here came off the disk, so it
  // has to be empty — the pull would otherwise hide a leak by dropping A's
  // plants as "deleted on another device".
  expect(onScreen(app, 'Alpha Fern')).toBe(false);
  expect(savedEntitlement()).not.toMatchObject({ is_plus: true });
  await advance(SETTLE_MS);

  // A's pull finally answers, into a session that no longer exists.
  pullA.resolve([plantDto('SA1', 'Alpha Fern')]);
  await advance(SETTLE_MS);

  expect(app.auth.status).toBe('signedIn');
  expect(authStore.tokens).toMatchObject({ access_token: 'B1', refresh_token: 'rB1' });
  // Disk, screen, the OS's queue and the plan all belong to B.
  expect(savedGarden().plants.map((p) => p.nickname)).toEqual(['Bravo Cactus']);
  expect(onScreen(app, 'Bravo Cactus')).toBe(true);
  expect(onScreen(app, 'Alpha Fern')).toBe(false);

  const lastCancel = Math.max(...Notifications.cancelAllScheduledNotificationsAsync.mock.invocationCallOrder);
  const scheduled = Notifications.scheduleNotificationAsync.mock.calls
    .filter((_, i) => Notifications.scheduleNotificationAsync.mock.invocationCallOrder[i] > lastCancel)
    .map(([req]) => req.content.title);
  expect(scheduled.length).toBeGreaterThan(0);
  expect(scheduled.every((title) => title.includes('Bravo Cactus'))).toBe(true);

  expect(savedEntitlement()).toMatchObject({ is_plus: false });
});
