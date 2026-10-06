// Harness for tests that cross the auth ⇄ API client ⇄ garden store seams.
//
// Not a test file: Jest's default testMatch only runs `__tests__/` and
// `*.test.js`, so this is imported, never run.
//
// Everything above the I/O is real: AuthProvider, api/client, api/*, the
// GardenProvider reducer and sync, store/persist and App.js's own AuthGate with
// its sign-out cleanup. What is faked is only what leaves the process:
//
//   • the network — a `fetch` router (`server.route(...)`) whose handlers may
//     hold a response open on a `deferred()`;
//   • SecureStore — `lib/authStorage` backed by `authStore` below (the test
//     file wires it with `jest.mock('…/lib/authStorage', () => require(…).fakeAuthStorage)`);
//   • connectivity — `lib/net`, same way, through `net.offline`;
//   • the filesystem — already in-memory in jest.setup.js, so store/persist and
//     the entitlement cache round-trip for real.
//
// No wall-clock sleeps: tests run on fake timers and move them with `advance()`.

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Deferred
// ---------------------------------------------------------------------------

/** A promise with its resolve/reject hanging off it. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

/** A fetch Response for `body`. */
export function json(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body == null ? '' : JSON.stringify(body)),
  };
}

/**
 * A fake backend. `route(method, pathPrefix, handler)` registers a handler; the
 * most recently registered match wins, so a test can override one endpoint
 * mid-scenario. A handler gets `{ method, path, body, bearer }` and returns a
 * body (200), a `json(...)` response, or a promise of either; throwing makes
 * the fetch reject like a dropped connection. Anything unrouted is a 404, and
 * with `server.offline` set every request fails the way iOS reports no radio.
 */
export function createServer() {
  const routes = [];
  const calls = [];
  const server = { offline: false };

  const fetch = jest.fn(async (url, init = {}) => {
    // What iOS reports for any request with the radio off.
    if (server.offline) throw new TypeError('Network request failed');
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = (init.method ?? 'GET').toUpperCase();
    const auth = init.headers?.Authorization ?? null;
    const req = {
      method,
      path,
      bearer: auth ? auth.replace(/^Bearer /, '') : null,
      body: typeof init.body === 'string' ? safeParse(init.body) : init.body ?? null,
    };
    calls.push(req);
    const match = [...routes].reverse().find((r) => r.method === method && path.startsWith(r.prefix));
    if (!match) return json({ detail: 'Not Found' }, 404);
    const out = await match.handler(req);
    return out && typeof out.ok === 'boolean' && typeof out.json === 'function' ? out : json(out);
  });

  return Object.assign(server, {
    fetch,
    calls,
    route(method, prefix, handler) {
      routes.push({ method: method.toUpperCase(), prefix, handler });
    },
    /** Calls to `method path` (a prefix), optionally filtered by bearer. */
    requests(method, prefix, bearer) {
      return calls.filter(
        (c) =>
          c.method === method.toUpperCase() &&
          c.path.startsWith(prefix) &&
          (bearer === undefined || c.bearer === bearer),
      );
    },
  });
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------------------
// SecureStore and connectivity
// ---------------------------------------------------------------------------

/** What SecureStore holds. `tokens` is the parsed record, or null. */
export const authStore = { tokens: null };

/** Drop-in for lib/authStorage, over `authStore`. */
export const fakeAuthStorage = {
  withExpiry(tokens, now = Date.now()) {
    if (!tokens) return tokens;
    if (tokens.expires_at != null || typeof tokens.expires_in !== 'number') return tokens;
    return { ...tokens, expires_at: now + tokens.expires_in * 1000 };
  },
  async saveTokens(tokens) {
    authStore.tokens = JSON.parse(JSON.stringify(fakeAuthStorage.withExpiry(tokens)));
  },
  async loadTokens() {
    return authStore.tokens ? { ...authStore.tokens } : null;
  },
  async clearTokens() {
    authStore.tokens = null;
  },
};

/** Drop-in for lib/net. Flip `net.offline` to make the OS report no network. */
export const net = {
  offline: false,
  isOffline: async () => net.offline,
};

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** An unsigned Google-shaped ID token carrying `claims`. */
export function idToken(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}

export const session = (access, refresh, { expiresInMs = 3600 * 1000 } = {}) => ({
  access_token: access,
  refresh_token: refresh,
  token_type: 'bearer',
  expires_at: Date.now() + expiresInMs,
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mounted = [];

/**
 * Mount the app's real AuthGate under the same providers App.js puts above
 * it. `app.auth` is the live useAuth() value, for driving sign-in and sign-out
 * the way the Login and Settings screens do.
 */
export async function renderApp() {
  // Required here rather than imported at the top so the test file's jest.mock
  // calls are in place before App.js pulls the module graph in.
  const { AuthGate } = require('../../App');
  const { AuthProvider, useAuth } = require('../../auth/AuthProvider');
  const { ThemeProvider } = require('../../theme/ThemeProvider');
  const { PrefsProvider } = require('../../prefs');

  const app = { auth: null, tree: null };
  function AuthProbe() {
    app.auth = useAuth();
    return null;
  }

  await act(async () => {
    app.tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <PrefsProvider>
          <ThemeProvider>
            <AuthProvider>
              <AuthProbe />
              <AuthGate />
            </AuthProvider>
          </ThemeProvider>
        </PrefsProvider>
      </SafeAreaProvider>,
    );
  });
  mounted.push(app.tree);
  app.texts = () => app.tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));
  return app;
}

/**
 * Mount the real AuthProvider and GardenProvider alone — the sync seam without
 * the screens. `view.garden` is the live useGarden() value; `view.auth` the
 * live useAuth() one.
 */
export async function renderGarden() {
  const { AuthProvider, useAuth } = require('../../auth/AuthProvider');
  const { GardenProvider, useGarden } = require('../../store/GardenProvider');

  const view = { auth: null, garden: null, tree: null };
  function Probe() {
    view.auth = useAuth();
    view.garden = useGarden();
    return null;
  }
  await act(async () => {
    view.tree = TestRenderer.create(
      <AuthProvider>
        <GardenProvider>
          <Probe />
        </GardenProvider>
      </AuthProvider>,
    );
  });
  mounted.push(view.tree);
  view.unmount = () => {
    act(() => view.tree.unmount());
    mounted.splice(mounted.indexOf(view.tree), 1);
  };
  return view;
}

/**
 * Let `ms` of fake time pass, and every promise it unblocks settle. Also used
 * with 0 to drain microtasks after resolving a deferred.
 */
export async function advance(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

const files = () => require('expo-file-system').__files;

/** The garden document as saved, or null. */
export function savedGarden() {
  const raw = files().get('file:///documents/cultum-garden.json');
  return raw ? JSON.parse(raw) : null;
}

/** The cached entitlement, or null. */
export function savedEntitlement() {
  const raw = files().get('file:///documents/cultum-entitlement.json');
  return raw ? JSON.parse(raw) : null;
}

/** Write a garden document to disk, as a previous launch would have. */
export function writeGarden(doc) {
  files().set('file:///documents/cultum-garden.json', JSON.stringify(doc));
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Unmount everything and reset the module singletons a mounted tree leaves
 * behind: the API client's token provider and 401 handler, the paywall cache,
 * the fake stores and the in-memory filesystem.
 */
export function cleanup() {
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
  const client = require('../../api/client');
  client.setAuthTokenProvider(null);
  client.setUnauthorizedHandler(null);
  require('../../billing/paywallContent').__resetPaywallCache();
  authStore.tokens = null;
  net.offline = false;
  files().clear();
  require('expo-file-system').__remote.clear();
}
