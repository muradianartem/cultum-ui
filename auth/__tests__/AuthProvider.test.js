import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthProvider';

// Persistence is mocked, but withExpiry is kept real — the expiry stamp is what
// the proactive-refresh tests below are actually about.
jest.mock('../../lib/authStorage', () => ({
  ...jest.requireActual('../../lib/authStorage'),
  loadTokens: jest.fn(),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
jest.mock('../../api/auth', () => ({
  authApi: {
    loginGoogle: jest.fn(),
    loginApple: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(async () => null),
  },
}));

jest.mock('../../api/account', () => ({
  getMe: jest.fn(async () => {
    throw new Error('not stubbed');
  }),
}));

const authStorage = require('../../lib/authStorage');
const { getMe } = require('../../api/account');
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
  expect(authStorage.saveTokens).toHaveBeenCalledWith(expect.objectContaining(minted));
  expect(ref.current.status).toBe('signedIn');
  expect(ref.current.tokens).toMatchObject(minted);
  // Stamped on the way in, so a later read can tell the token is stale.
  expect(ref.current.tokens.expires_at).toEqual(expect.any(Number));
});

// Apple's identity token carries no name claim — the name comes in from the
// screen, out of the one-time credential — so it has to be both forwarded to
// the backend and written next to the tokens, or the greeting is gone the
// moment the app relaunches.
test('completeAppleLogin forwards the name and persists it alongside the tokens', async () => {
  authStorage.loadTokens.mockResolvedValue(null);
  const minted = { access_token: 'A', refresh_token: 'R', token_type: 'bearer', expires_in: 3600 };
  authApi.loginApple.mockResolvedValue(minted);

  const { ref } = await renderAuth();

  await act(async () => {
    await ref.current.completeAppleLogin('apple-id-token', 'Ada');
  });

  expect(authApi.loginApple).toHaveBeenCalledWith('apple-id-token', 'Ada');
  expect(authStorage.saveTokens).toHaveBeenCalledWith(expect.objectContaining({
    access_token: 'A',
    name: 'Ada',
  }));
  expect(ref.current.status).toBe('signedIn');
  expect(ref.current.profileName).toBe('Ada');
});

// A returning Apple user gets no name at all; the session still has to open.
test('completeAppleLogin signs in with no name when Apple withheld one', async () => {
  authStorage.loadTokens.mockResolvedValue(null);
  authApi.loginApple.mockResolvedValue({
    access_token: 'A',
    refresh_token: 'R',
    token_type: 'bearer',
    expires_in: 3600,
  });

  const { ref } = await renderAuth();

  await act(async () => {
    await ref.current.completeAppleLogin('apple-id-token', null);
  });

  expect(ref.current.status).toBe('signedIn');
  expect(ref.current.profileName).toBeNull();
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
  expect(authStorage.saveTokens).toHaveBeenCalledWith(expect.objectContaining(rotated));
  expect(ref.current.tokens).toMatchObject(rotated);
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

// ---------------------------------------------------------------------------
// Proactive rotation. Waiting for a 401 means the request is sent twice — and
// for a scan, "the request" is the user's photo.
// ---------------------------------------------------------------------------
describe('proactive refresh', () => {
  const client = require('../../api/client');

  const expiring = (msFromNow) => ({
    access_token: 'about-to-expire',
    refresh_token: 'r1',
    expires_at: Date.now() + msFromNow,
  });

  test('rotates before a request when the access token is within the skew window', async () => {
    authStorage.loadTokens.mockResolvedValueOnce(expiring(30000)); // < 60s left
    authApi.refresh.mockResolvedValueOnce({ access_token: 'fresh', refresh_token: 'r2' });

    await renderAuth();

    await act(async () => {
      await expect(client.getAuthToken()).resolves.toBe('fresh');
    });
    expect(authApi.refresh).toHaveBeenCalledWith('r1');
  });

  test('leaves a token with time left alone', async () => {
    authStorage.loadTokens.mockResolvedValueOnce(expiring(3600000));

    await renderAuth();

    await expect(client.getAuthToken()).resolves.toBe('about-to-expire');
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  test('treats a session with no recorded expiry as usable', async () => {
    authStorage.loadTokens.mockResolvedValueOnce({ access_token: 'legacy', refresh_token: 'r' });

    await renderAuth();

    await expect(client.getAuthToken()).resolves.toBe('legacy');
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  test('rejects with the rotation error rather than sending the request unauthenticated', async () => {
    authStorage.loadTokens.mockResolvedValueOnce(expiring(-1000)); // already expired
    authApi.refresh.mockRejectedValueOnce(
      Object.assign(new Error('refresh token reused'), { status: 401 })
    );

    const { ref } = await renderAuth();

    await act(async () => {
      await expect(client.getAuthToken()).rejects.toMatchObject({ status: 401 });
    });
    expect(ref.current.status).toBe('signedOut');
  });

  test('collapses concurrent rotations into one — a spent refresh token is rejected', async () => {
    authStorage.loadTokens.mockResolvedValueOnce(expiring(-1000));
    authApi.refresh.mockResolvedValueOnce({ access_token: 'fresh', refresh_token: 'r2' });

    const { ref } = await renderAuth();

    await act(async () => {
      await Promise.all([
        client.getAuthToken(),
        client.getAuthToken(),
        ref.current.refreshSession(),
      ]);
    });

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });
});

// `signedInVia` is what billing/entry.js keys the paywall off. It matters that
// it is settled by the time `status` says signedIn — App.js reads it on the
// render that mounts the Router, and the Router reads its initial route once.
describe('signedInVia', () => {
  test('is null before anything has signed in', async () => {
    authStorage.loadTokens.mockResolvedValue(null);
    const { ref } = await renderAuth();
    expect(ref.current.signedInVia).toBeNull();
  });

  test('reports a restored session as such', async () => {
    authStorage.loadTokens.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    const { ref } = await renderAuth();
    expect(ref.current.status).toBe('signedIn');
    expect(ref.current.signedInVia).toBe('restore');
  });

  test('reports a completed Google or Apple sign-in as a login', async () => {
    authStorage.loadTokens.mockResolvedValue(null);
    authApi.loginGoogle.mockResolvedValue({ access_token: 'g', refresh_token: 'r', expires_in: 3600 });
    const google = await renderAuth();
    await act(async () => {
      await google.ref.current.completeGoogleLogin('the-id-token');
    });
    expect(google.ref.current.signedInVia).toBe('login');

    authApi.loginApple.mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 3600 });
    const apple = await renderAuth();
    await act(async () => {
      await apple.ref.current.completeAppleLogin('apple-id-token', 'Ada');
    });
    expect(apple.ref.current.signedInVia).toBe('login');
  });

  test('survives a token rotation — the session did not begin again', async () => {
    authStorage.loadTokens.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    authApi.refresh.mockResolvedValue({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600 });
    const { ref } = await renderAuth();
    await act(async () => {
      await ref.current.refreshSession();
    });
    expect(ref.current.signedInVia).toBe('restore');
  });

  test('is cleared by signing out and by a rejected refresh', async () => {
    authStorage.loadTokens.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    const out = await renderAuth();
    await act(async () => {
      await out.ref.current.signOut();
    });
    expect(out.ref.current.signedInVia).toBeNull();

    authApi.refresh.mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }));
    const rejected = await renderAuth();
    await act(async () => {
      await expect(rejected.ref.current.refreshSession()).rejects.toMatchObject({ status: 401 });
    });
    expect(rejected.ref.current.signedInVia).toBeNull();
  });
});

describe('GET /users/me at sign-in', () => {
  const minted = { access_token: 'A', refresh_token: 'R', token_type: 'bearer', expires_in: 3600 };
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    authStorage.loadTokens.mockResolvedValue(null);
    authApi.loginGoogle.mockResolvedValue(minted);
  });
  afterEach(() => console.warn.mockRestore());

  test.each([true, false])('onboarding_shown %s is exposed once signed in', async (shown) => {
    getMe.mockResolvedValueOnce({ id: 'u', onboarding_shown: shown });
    const { ref } = await renderAuth();
    await act(async () => {
      await ref.current.completeGoogleLogin('the-id-token');
    });
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(ref.current.status).toBe('signedIn');
    expect(ref.current.onboardingShown).toBe(shown);
  });

  test('a failed read still signs in, with no answer', async () => {
    getMe.mockRejectedValueOnce(new Error('offline'));
    const { ref } = await renderAuth();
    await act(async () => {
      await ref.current.completeGoogleLogin('the-id-token');
    });
    expect(ref.current.status).toBe('signedIn');
    expect(ref.current.onboardingShown).toBeNull();
  });

  test('a restored session does not ask', async () => {
    authStorage.loadTokens.mockResolvedValue(minted);
    const { ref } = await renderAuth();
    expect(ref.current.status).toBe('signedIn');
    expect(getMe).not.toHaveBeenCalled();
    expect(ref.current.onboardingShown).toBeNull();
  });

  test('sign-out forgets the answer', async () => {
    getMe.mockResolvedValueOnce({ id: 'u', onboarding_shown: true });
    const { ref } = await renderAuth();
    await act(async () => {
      await ref.current.completeGoogleLogin('the-id-token');
    });
    await act(async () => {
      await ref.current.signOut();
    });
    expect(ref.current.onboardingShown).toBeNull();
  });
});
