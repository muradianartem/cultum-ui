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
    await expect(client.getAuthToken()).rejects.toMatchObject({ status: 401 });
  });

  expect(refreshCalls()).toHaveLength(1);
  expect(ref.current.status).toBe('signedOut');
  expect(authStorage.clearTokens).toHaveBeenCalled();
});

test('a session with no refresh token ends without a round trip', async () => {
  authStorage.loadTokens.mockResolvedValue({ access_token: 'stale', expires_at: Date.now() - 1000 });

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(client.getAuthToken()).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });

  expect(refreshCalls()).toHaveLength(0);
  expect(ref.current.status).toBe('signedOut');
});

// ---------------------------------------------------------------------------
// Transient refresh failures keep the session
// ---------------------------------------------------------------------------

const net = require('../../lib/net');

test('an offline refresh keeps the session and surfaces the offline error', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  net.isOffline.mockResolvedValueOnce(true);
  fetch.mockRejectedValue(new TypeError('Network request failed'));

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(client.getAuthToken()).rejects.toMatchObject({ code: 'offline' });
  });

  expect(refreshCalls()).toHaveLength(1);
  expect(ref.current.status).toBe('signedIn');
  expect(authStorage.clearTokens).not.toHaveBeenCalled();
});

test.each([500, 429, 403])('a refresh answered %i keeps the session and surfaces the error', async (status) => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  fetch.mockResolvedValue(json({ detail: 'nope' }, status));

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(client.getAuthToken()).rejects.toMatchObject({ status });
  });

  expect(ref.current.status).toBe('signedIn');
  expect(authStorage.clearTokens).not.toHaveBeenCalled();
});

const plantCalls = () =>
  fetch.mock.calls.filter(([url]) => String(url).endsWith('/users/me/plants'));

test('an expired token offline never sends the protected request', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  net.isOffline.mockResolvedValueOnce(true);
  fetch.mockRejectedValue(new TypeError('Network request failed'));

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(client.apiFetch('/users/me/plants')).rejects.toMatchObject({ code: 'offline' });
  });

  expect(plantCalls()).toHaveLength(0);
  expect(ref.current.status).toBe('signedIn');
});

test('a 401 whose refresh times out reports the timeout, not the 401', async () => {
  authStorage.loadTokens.mockResolvedValue({ ...EXPIRED_SESSION, expires_at: Date.now() + 3600e3 });
  fetch.mockImplementation((url, { signal }) =>
    String(url).endsWith('/auth/refresh')
      ? new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted'))))
      : Promise.resolve(json({ detail: 'expired' }, 401))
  );

  const { ref } = await renderAuth();
  jest.useFakeTimers();
  try {
    await act(async () => {
      const call = client.apiFetch('/users/me/plants');
      const settled = expect(call).rejects.toMatchObject({ code: 'timeout' });
      await jest.advanceTimersByTimeAsync(client.DEFAULT_TIMEOUT_MS);
      await settled;
    });
  } finally {
    jest.useRealTimers();
  }

  expect(refreshCalls()).toHaveLength(1);
  expect(ref.current.status).toBe('signedIn');
});

// ---------------------------------------------------------------------------
// A rotation that settles after the session changed is stale
// ---------------------------------------------------------------------------

/** Holds /auth/refresh open until `release()`; every other call answers `other`. */
function deferRefresh(other = () => json(null, 204)) {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  fetch.mockImplementation((url) =>
    String(url).endsWith('/auth/refresh') ? pending : Promise.resolve(other(url))
  );
  return (body = ROTATED) => release(json(body));
}

test('a refresh that lands after sign-out does not revive the session', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  const release = deferRefresh();

  const { ref } = await renderAuth();

  let rotation;
  await act(async () => {
    rotation = ref.current.refreshSession();
    rotation.catch(() => {});
    await Promise.resolve();
    await ref.current.signOut();
  });
  await act(async () => {
    release();
    await rotation.catch(() => {});
  });

  expect(ref.current.status).toBe('signedOut');
  const cleared = authStorage.clearTokens.mock.invocationCallOrder.at(-1);
  const saves = authStorage.saveTokens.mock.invocationCallOrder;
  expect(saves.filter((n) => n > cleared)).toEqual([]);
  await expect(client.getAuthToken()).resolves.toBeNull();
});

const NEW_LOGIN = {
  access_token: 'second-account',
  refresh_token: 'r-new',
  token_type: 'bearer',
  expires_in: 3600,
};

test('a refresh that lands after signing in again never replaces the new tokens', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  const release = deferRefresh((url) =>
    String(url).endsWith('/auth/google') ? json(NEW_LOGIN) : json(null, 204)
  );

  const { ref } = await renderAuth();

  let rotation;
  await act(async () => {
    rotation = ref.current.refreshSession();
    rotation.catch(() => {});
    await Promise.resolve();
    await ref.current.signOut();
    await ref.current.completeGoogleLogin('header.e30.sig');
  });
  await act(async () => {
    release();
    await rotation.catch(() => {});
  });

  expect(ref.current.status).toBe('signedIn');
  expect(ref.current.tokens.access_token).toBe('second-account');
  await expect(client.getAuthToken()).resolves.toBe('second-account');
  expect(authStorage.saveTokens).toHaveBeenLastCalledWith(
    expect.objectContaining({ access_token: 'second-account' })
  );
});

test('a stale rotation settling does not unlock the new session’s rotation', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  const releases = [];
  fetch.mockImplementation((url) => {
    if (String(url).endsWith('/auth/google')) return Promise.resolve(json(NEW_LOGIN));
    if (!String(url).endsWith('/auth/refresh')) return Promise.resolve(json(null, 204));
    return new Promise((resolve) => releases.push(() => resolve(json(ROTATED))));
  });

  const { ref } = await renderAuth();

  let stale, current;
  await act(async () => {
    stale = ref.current.refreshSession();
    stale.catch(() => {});
    await Promise.resolve();
    await ref.current.signOut();
    await ref.current.completeGoogleLogin('header.e30.sig');
    current = ref.current.refreshSession();
    await Promise.resolve();
  });
  await act(async () => {
    releases[0]();
    await stale.catch(() => {});
  });

  expect(ref.current.refreshSession()).toBe(current);
  const spent = refreshCalls().map(([, init]) => JSON.parse(init.body).refresh_token);
  expect(spent).toEqual(['r1', 'r-new']);

  await act(async () => {
    releases[1]();
    await current;
  });
});

test('sign-out’s clear reaches storage after a rotation’s in-flight save, never before', async () => {
  authStorage.loadTokens.mockResolvedValue(EXPIRED_SESSION);
  fetch.mockImplementation((url) =>
    Promise.resolve(String(url).endsWith('/auth/refresh') ? json(ROTATED) : json(null, 204))
  );
  const events = [];
  let finishSave;
  authStorage.saveTokens.mockImplementationOnce(() => {
    events.push('save:start');
    return new Promise((resolve) => {
      finishSave = () => {
        events.push('save:end');
        resolve();
      };
    });
  });
  authStorage.clearTokens.mockImplementation(async () => {
    events.push('clear');
  });

  const { ref } = await renderAuth();

  let rotation, signingOut;
  await act(async () => {
    rotation = ref.current.refreshSession();
    rotation.catch(() => {});
    while (!finishSave) await new Promise((r) => setTimeout(r, 0));
    signingOut = ref.current.signOut();
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    finishSave();
    await signingOut;
    await rotation.catch(() => {});
  });

  expect(events).toEqual(['save:start', 'save:end', 'clear']);
  expect(ref.current.status).toBe('signedOut');
});
