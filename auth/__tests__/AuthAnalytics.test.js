import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth, userIdFromAccessToken } from '../AuthProvider';
import { __setAnalyticsClient } from '../../lib/analytics';

jest.mock('../../lib/authStorage', () => ({
  ...jest.requireActual('../../lib/authStorage'),
  loadTokens: jest.fn(),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
jest.mock('../../api/auth', () => ({
  authApi: { loginGoogle: jest.fn(), loginApple: jest.fn(), refresh: jest.fn(), logout: jest.fn(async () => null) },
}));
jest.mock('../../api/account', () => ({
  getMe: jest.fn(async () => {
    throw new Error('not stubbed');
  }),
}));

const authStorage = require('../../lib/authStorage');
const { authApi } = require('../../api/auth');

// An unsigned JWT carrying `claims` — the app never verifies, only reads.
const jwt = (claims) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

const session = (sub, extra = {}) => ({
  access_token: jwt({ sub }),
  refresh_token: `r-${sub}`,
  token_type: 'bearer',
  expires_in: 3600,
  ...extra,
});

async function renderAuth() {
  const ref = {};
  function Probe() {
    ref.current = useAuth();
    return null;
  }
  await act(async () => {
    TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  return ref;
}

let client;
beforeEach(() => {
  client = { identify: jest.fn(), reset: jest.fn() };
  __setAnalyticsClient(client);
});
afterEach(() => {
  __setAnalyticsClient(undefined);
  jest.clearAllMocks();
});

test('userIdFromAccessToken reads the sub, and is null for an opaque token', () => {
  expect(userIdFromAccessToken(jwt({ sub: 'u-1' }))).toBe('u-1');
  expect(userIdFromAccessToken(jwt({ sub: 7 }))).toBe('7');
  expect(userIdFromAccessToken('dev-access')).toBeNull();
});

test('a restored session identifies the user by backend id', async () => {
  authStorage.loadTokens.mockResolvedValue(session('u-1'));
  await renderAuth();
  expect(client.identify).toHaveBeenCalledWith('u-1', undefined);
});

test('a fresh sign-in identifies; a rotation for the same user does not again', async () => {
  authStorage.loadTokens.mockResolvedValue(null);
  authApi.loginGoogle.mockResolvedValue(session('u-2'));
  const ref = await renderAuth();
  expect(client.identify).not.toHaveBeenCalled();

  await act(async () => {
    await ref.current.completeGoogleLogin('id-token');
  });
  expect(client.identify).toHaveBeenCalledTimes(1);
  expect(client.identify).toHaveBeenCalledWith('u-2', undefined);

  authApi.refresh.mockResolvedValue(session('u-2', { refresh_token: 'r-next' }));
  await act(async () => {
    await ref.current.refreshSession();
  });
  expect(client.identify).toHaveBeenCalledTimes(1);
});

test('signing out resets the analytics identity', async () => {
  authStorage.loadTokens.mockResolvedValue(session('u-3'));
  const ref = await renderAuth();
  await act(async () => {
    await ref.current.signOut();
  });
  expect(client.reset).toHaveBeenCalled();
});

test('a rejected refresh resets the identity too', async () => {
  authStorage.loadTokens.mockResolvedValue(session('u-4'));
  const ref = await renderAuth();
  authApi.refresh.mockRejectedValue(Object.assign(new Error('no'), { status: 401 }));
  await act(async () => {
    await ref.current.refreshSession().catch(() => {});
  });
  expect(client.reset).toHaveBeenCalled();
});
