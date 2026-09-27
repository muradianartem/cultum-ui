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
import { AppState } from 'react-native';
import { seedGarden } from '../store/testing';

jest.mock('../lib/authStorage', () => require('../test/support/integration').fakeAuthStorage);
jest.mock('../lib/net', () => require('../test/support/integration').net);

const Notifications = require('expo-notifications');

// Midday, so a 09:00 reminder due today has already come due and is on Today.
const NOW = new Date(2026, 8, 21, 12, 0, 0);

// GardenProvider's debounces, with a little room: save 400, reschedule 1500,
// media 1200.
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
test('cold launch with an expired token, online: one refresh, then the garden on the new bearer', async () => {
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
  expect(savedGarden().plants.map((p) => p.id)).toEqual(['SA1']);
});

// Guards 04: a refresh that fails because the radio is off used to end the
// session, and AuthGate's sign-out cleanup then wiped the garden.
//
// There is no offline mode: the garden is not shown, a Retry is. But the mirror
// of the last server answer stays on disk, and the reminders it holds are still
// scheduled — those are local notifications, and nothing else can fire them.
test('cold launch with an expired token, offline: still signed in, a Retry, reminders still scheduled', async () => {
  authStore.tokens = session('A0', 'rA1', { expiresInMs: -60 * 1000 });
  const doc = seedGarden({
    now: NOW,
    plants: [
      { nickname: 'Offline Olive', room: 'Kitchen', reminders: [{ action: 'water', dueInDays: 1 }] },
    ],
  });
  writeGarden(doc);
  serve({ gardens: { a: () => [] }, entitlements: { a: entitlementDto(false) } });
  server.offline = true;
  net.offline = true;

  const app = await renderApp();
  await advance(SETTLE_MS);

  expect(app.auth.status).toBe('signedIn');
  expect(authStore.tokens).toMatchObject({ refresh_token: 'rA1' });
  expect(onScreen(app, 'Couldn’t load your garden')).toBe(true);
  expect(onScreen(app, 'Offline Olive')).toBe(false);
  expect(savedGarden().plants.map((p) => p.nickname)).toEqual(['Offline Olive']);
  const titles = Notifications.scheduleNotificationAsync.mock.calls.map(([req]) => req.content.title);
  expect(titles.some((title) => title.includes('Offline Olive'))).toBe(true);
});

// Guards the sign-out path as a whole: AuthGate's cleanup (dropping any one of
// clearState, cancelAll or clearEntitlement fails this), and a load still in
// flight for the previous user never landing in the next one's garden.
test('switching accounts leaves nothing of the first one behind', async () => {
  // A is signed in with a plant, Plus, and a reminder queued with the OS.
  authStore.tokens = session('A1', 'rA1');
  require('expo-file-system').__files.set(
    'file:///documents/cultum-entitlement.json',
    JSON.stringify(entitlementDto(true)),
  );
  // A's first load answers; the refresh on coming back to the foreground hangs.
  const pullA = deferred();
  let loadsA = 0;
  const alphaLater = new Date(NOW.getTime() - 6 * 24 * 3600 * 1000).toISOString();
  const gardenA = () => [
    { ...plantDto('SA1', 'Alpha Fern'), reminders: [{ ...reminderDto('R-SA1', 'SA1'), last_done_at: alphaLater }] },
  ];
  serve({
    gardens: {
      a: () => {
        loadsA += 1;
        return loadsA === 1 ? gardenA() : pullA.promise;
      },
      b: () => [plantDto('SB1', 'Bravo Cactus')],
    },
    entitlements: { a: entitlementDto(true), b: entitlementDto(false) },
  });
  const listen = jest.spyOn(AppState, 'addEventListener');
  server.route('POST', '/auth/google', () => ({
    access_token: 'B1',
    refresh_token: 'rB1',
    token_type: 'bearer',
    expires_in: 3600,
  }));

  const app = await renderApp();
  await advance(SETTLE_MS); // A's garden is in and its reminder scheduled
  expect(onScreen(app, 'Alpha Fern')).toBe(true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  expect(savedGarden().plants.map((p) => p.id)).toEqual(['SA1']);

  // Back to the foreground: A's refresh goes out, and hangs.
  // Every live subscription hears it, as it would from the OS; ones already
  // removed (an effect that re-subscribed) do not.
  const listeners = listen.mock.calls
    .map(([type, fn], i) => ({ type, fn, sub: listen.mock.results[i].value }))
    .filter(({ type, sub }) => type === 'change' && !sub?.remove?.mock?.calls.length)
    .map(({ fn }) => fn);
  await act(async () => listeners.forEach((fn) => fn('active')));
  await advance(SETTLE_MS);
  expect(server.requests('GET', '/users/me/plants', 'A1')).toHaveLength(2);

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
  // Before B's own load, nothing of A's is on screen or on disk.
  expect(onScreen(app, 'Alpha Fern')).toBe(false);
  expect(savedGarden()?.plants.map((p) => p.nickname) ?? []).not.toContain('Alpha Fern');
  expect(savedEntitlement()).not.toMatchObject({ is_plus: true });
  await advance(SETTLE_MS);

  // A's refresh finally answers, into a session that no longer exists.
  pullA.resolve(gardenA());
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
