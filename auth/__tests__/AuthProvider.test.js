import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthProvider';

jest.mock('../../lib/authStorage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
jest.mock('../../api/auth', () => ({
  authApi: {
    loginGoogle: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(async () => null),
  },
}));

const authStorage = require('../../lib/authStorage');
const { authApi } = require('../../api/auth');

// Probe component that pushes the current auth value out to the test.
async function renderAuth() {
  const ref = {};
  function Probe() {
    ref.current = useAuth();
    return null;
  }
  let tree;
  await act(async () => {
    tree = TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  return { ref, tree };
}

afterEach(() => jest.clearAllMocks());

test('mount with no stored tokens resolves to signedOut', async () => {
  authStorage.loadTokens.mockResolvedValue(null);
  const { ref } = await renderAuth();
  expect(ref.current.status).toBe('signedOut');
  expect(ref.current.tokens).toBeNull();
});

test('mount with stored tokens resolves to signedIn with those tokens', async () => {
  const stored = { access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 3600 };
  authStorage.loadTokens.mockResolvedValue(stored);
  const { ref } = await renderAuth();
  expect(ref.current.status).toBe('signedIn');
  expect(ref.current.tokens).toEqual(stored);
});

test('completeGoogleLogin exchanges the id token, persists, and flips to signedIn', async () => {
  authStorage.loadTokens.mockResolvedValue(null);
  const minted = { access_token: 'A', refresh_token: 'R', token_type: 'bearer', expires_in: 3600 };
  authApi.loginGoogle.mockResolvedValue(minted);

  const { ref } = await renderAuth();
  expect(ref.current.status).toBe('signedOut');

  await act(async () => {
    await ref.current.completeGoogleLogin('the-id-token');
  });

  expect(authApi.loginGoogle).toHaveBeenCalledWith('the-id-token');
  expect(authStorage.saveTokens).toHaveBeenCalledWith(minted);
  expect(ref.current.status).toBe('signedIn');
  expect(ref.current.tokens).toEqual(minted);
});

test('signOut clears storage and flips to signedOut even if the logout call fails', async () => {
  const stored = { access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 3600 };
  authStorage.loadTokens.mockResolvedValue(stored);
  authApi.logout.mockRejectedValue(new Error('network'));

  const { ref } = await renderAuth();
  expect(ref.current.status).toBe('signedIn');

  await act(async () => {
    await ref.current.signOut();
  });

  expect(authApi.logout).toHaveBeenCalledWith('r');
  expect(authStorage.clearTokens).toHaveBeenCalled();
  expect(ref.current.status).toBe('signedOut');
  expect(ref.current.tokens).toBeNull();
});

test('refreshSession rotates the refresh token and persists the new token set', async () => {
  const stored = { access_token: 'a1', refresh_token: 'r1', token_type: 'bearer', expires_in: 3600 };
  const rotated = { access_token: 'a2', refresh_token: 'r2', token_type: 'bearer', expires_in: 3600 };
  authStorage.loadTokens.mockResolvedValue(stored);
  authApi.refresh.mockResolvedValue(rotated);

  const { ref } = await renderAuth();

  await act(async () => {
    await ref.current.refreshSession();
  });

  expect(authApi.refresh).toHaveBeenCalledWith('r1');
  expect(authStorage.saveTokens).toHaveBeenCalledWith(rotated);
  expect(ref.current.tokens).toEqual(rotated);
  expect(ref.current.status).toBe('signedIn');
});

test('refreshSession signs out when the refresh token is rejected', async () => {
  const stored = { access_token: 'a1', refresh_token: 'r1', token_type: 'bearer', expires_in: 3600 };
  authStorage.loadTokens.mockResolvedValue(stored);
  authApi.refresh.mockRejectedValue(Object.assign(new Error('bad'), { status: 401 }));

  const { ref } = await renderAuth();

  await act(async () => {
    await expect(ref.current.refreshSession()).rejects.toMatchObject({ status: 401 });
  });

  expect(authStorage.clearTokens).toHaveBeenCalled();
  expect(ref.current.status).toBe('signedOut');
  expect(ref.current.tokens).toBeNull();
});

// ---------------------------------------------------------------------------
// apiFetch wiring. Nothing registered these before, so every authenticated
// request went out with no Authorization header and 401'd.
// ---------------------------------------------------------------------------
describe('apiFetch registration', () => {
  const client = require('../../api/client');

  test('registers a token provider that reports the stored access token', async () => {
    authStorage.loadTokens.mockResolvedValueOnce({
      access_token: 'stored-access',
      refresh_token: 'stored-refresh',
    });

    await renderAuth();

    await expect(client.getAuthToken()).resolves.toBe('stored-access');
  });

  test('reports null rather than undefined when signed out', async () => {
    authStorage.loadTokens.mockResolvedValueOnce(null);

    await renderAuth();

    await expect(client.getAuthToken()).resolves.toBeNull();
  });

  test('the token provider sees a rotated token immediately, before any re-render', async () => {
    authStorage.loadTokens.mockResolvedValueOnce({
      access_token: 'expired',
      refresh_token: 'r1',
    });
    authApi.refresh.mockResolvedValueOnce({
      access_token: 'rotated',
      refresh_token: 'r2',
    });

    const { ref } = await renderAuth();
    await act(async () => {
      await ref.current.refreshSession();
    });

    // apiFetch reads the token back on the next line of its retry, so the
    // provider must not wait for React to re-render the provider.
    await expect(client.getAuthToken()).resolves.toBe('rotated');
  });

  test('refreshes with the current refresh token, not the one captured at mount', async () => {
    authStorage.loadTokens.mockResolvedValueOnce(null); // starts signed out
    authApi.loginGoogle.mockResolvedValueOnce({
      access_token: 'a1',
      refresh_token: 'r1',
    });
    authApi.refresh.mockResolvedValueOnce({ access_token: 'a2', refresh_token: 'r2' });

    const { ref } = await renderAuth();
    await act(async () => {
      await ref.current.completeGoogleLogin('google-id-token');
    });
    await act(async () => {
      await ref.current.refreshSession();
    });

    expect(authApi.refresh).toHaveBeenCalledWith('r1');
  });
});
