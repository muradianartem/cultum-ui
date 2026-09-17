// Rotation against the *real* api/auth and api/client.
//
// AuthProvider.test.js mocks `api/auth` wholesale, which is what let the cold-launch
// bug live: with the network layer stubbed out, a rotation never went through
// apiFetch, so nothing ever exercised the seam where apiFetch asks AuthProvider for
// an access token *while AuthProvider is asking apiFetch to mint one*. That seam is
// the whole subject of this file, so only persistence and the network are faked.

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthProvider';

jest.mock('../../lib/authStorage', () => ({
  ...jest.requireActual('../../lib/authStorage'),
  loadTokens: jest.fn(),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
jest.mock('../../lib/net', () => ({ isOffline: jest.fn(async () => false) }));

const authStorage = require('../../lib/authStorage');
const client = require('../../api/client');

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// A session restored from SecureStore whose access token expired while the app
// was killed — the exact state of every cold launch after `expires_in`.
const EXPIRED_SESSION = {
  access_token: 'stale',
  refresh_token: 'r1',
  token_type: 'bearer',
  expires_at: Date.now() - 1000,
};

const ROTATED = {
  access_token: 'fresh',
  refresh_token: 'r2',
  token_type: 'bearer',
  expires_in: 3600,
};

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
  return { ref };
}

const refreshCalls = () =>
  fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'));

beforeEach(() => {
  global.fetch = jest.fn();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  client.setAuthTokenProvider(null);
  client.setUnauthorizedHandler(null);
});

test('a restored session with an expired access token rotates instead of signing out', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  fetch.mockResolvedValue(json(ROTATED));

  const { ref } = await renderAuth();
  expect(ref.current.status).toBe('signedIn');

  await act(async () => {
    await expect(client.getAuthToken()).resolves.toBe('fresh');
  });

  expect(refreshCalls()).toHaveLength(1);
  expect(ref.current.status).toBe('signedIn');
  expect(authStorage.clearTokens).not.toHaveBeenCalled();
});

test('a rotation carries the stored profile forward', async () => {
  authStorage.loadTokens.mockResolvedValue({
    ...EXPIRED_SESSION,
    name: 'Ada',
    email: 'ada@example.com',
    emailIsPrivate: false,
  });
  fetch.mockResolvedValue(json(ROTATED));

  const { ref } = await renderAuth();
  await act(async () => {
    await client.getAuthToken();
  });

  expect(authStorage.saveTokens).toHaveBeenLastCalledWith(
    expect.objectContaining({
      access_token: 'fresh',
      refresh_token: 'r2',
      name: 'Ada',
      email: 'ada@example.com',
    })
  );
  expect(ref.current.profileName).toBe('Ada');
});

test('the rotation request carries no bearer of its own', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  fetch.mockResolvedValue(json(ROTATED));

  await renderAuth();
  await act(async () => {
    await client.getAuthToken();
  });

  const [, init] = refreshCalls()[0];
  expect(init.headers.Authorization).toBeUndefined();
  expect(JSON.parse(init.body)).toEqual({ refresh_token: 'r1' });
});

test('concurrent demands for a token spend the refresh token exactly once', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  fetch.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(json(ROTATED)), 10))
  );

  const { ref } = await renderAuth();

  await act(async () => {
    const [a, b] = await Promise.all([
      client.getAuthToken(),
      client.getAuthToken(),
      ref.current.refreshSession(),
    ]);
    expect(a).toBe('fresh');
    expect(b).toBe('fresh');
  });

  expect(refreshCalls()).toHaveLength(1);
});

test('a rejected refresh token ends the session', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  fetch.mockResolvedValue(json({ detail: 'refresh token reused' }, 401));

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(client.getAuthToken()).resolves.toBeNull();
  });

  expect(refreshCalls()).toHaveLength(1);
  expect(ref.current.status).toBe('signedOut');
  expect(authStorage.clearTokens).toHaveBeenCalled();
});

test('a session with no refresh token ends without a round trip', async () => {
  authStorage.loadTokens.mockResolvedValue({ access_token: 'stale', expires_at: Date.now() - 1000 });

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(client.getAuthToken()).resolves.toBeNull();
  });

  expect(refreshCalls()).toHaveLength(0);
  expect(ref.current.status).toBe('signedOut');
});
