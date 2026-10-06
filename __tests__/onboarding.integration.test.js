// Onboarding end to end, through the real AuthGate: a fresh sign-in lands on
// onboarding, its paywall finishes it on Today, and finishing sticks — across
// a sign-out, which clears the garden but not the installation's onboarding.
//
// Only what leaves the process is faked (test/support/integration.js).

import { act } from 'react-test-renderer';
import {
  advance,
  cleanup,
  createServer,
  idToken,
  renderApp,
} from '../test/support/integration';

jest.mock('../lib/authStorage', () => require('../test/support/integration').fakeAuthStorage);
jest.mock('../lib/net', () => require('../test/support/integration').net);

const ONBOARDING_FILE = 'file:///documents/cultum-onboarding.json';
const savedOnboarding = () => {
  const raw = require('expo-file-system').__files.get(ONBOARDING_FILE);
  return raw ? JSON.parse(raw) : null;
};

let server;
beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 8, 22, 12) });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  server = createServer();
  global.fetch = server.fetch;
  server.route('POST', '/auth/google', () => ({
    access_token: 'A1',
    refresh_token: 'rA1',
    token_type: 'bearer',
    expires_in: 3600,
  }));
  server.route('POST', '/auth/logout', () => null);
  server.route('GET', '/users/me/rooms', () => []);
  server.route('GET', '/users/me/plants', () => []);
});

afterEach(async () => {
  cleanup();
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const press = (app, label) => {
  const nodes = app.tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label,
  );
  if (!nodes.length) throw new Error(`No pressable labelled “${label}”`);
  act(() => nodes[nodes.length - 1].props.onPress());
};

const signIn = async (app) => {
  await act(async () => {
    await app.auth.completeGoogleLogin(idToken({ given_name: 'Ada', email: 'ada@example.com' }));
  });
  await advance(0);
};

test('a fresh sign-in runs onboarding, and its paywall finishes it on Today for good', async () => {
  const app = await renderApp();
  expect(app.texts()).toContain('Continue with Google');

  await signIn(app);
  expect(app.texts()).toContain('Scan a plant');
  expect(app.texts()).not.toContain('Today’s tasks');

  press(app, 'Skip'); // intro → Add your first plant
  expect(app.texts()).toContain('Add your first plant');
  press(app, 'Skip'); // → the onboarding paywall, no plant
  await advance(0);
  expect(savedOnboarding()).toMatchObject({ stage: 'paywall' });

  // The plans endpoint is not routed here, so the paywall is in its error
  // state — which must still let the user out.
  press(app, 'Close');
  expect(app.texts()).toContain('Today’s tasks');
  expect(savedOnboarding()).toMatchObject({ stage: 'complete' });

  // Signing out clears the account's garden, not the installation's
  // onboarding: the next sign-in goes straight to Today.
  await act(async () => {
    await app.auth.signOut();
  });
  await advance(0);
  await signIn(app);
  expect(app.texts()).toContain('Today’s tasks');
  expect(app.texts()).not.toContain('Scan a plant');
});
