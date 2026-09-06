// Auth session state + the token exchange/persistence orchestration. The Google
// ID-token acquisition (the useAuthRequest hook) lives in the Login screen, not
// here — this provider only owns exchange + storage.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadTokens, saveTokens, clearTokens, withExpiry } from '../lib/authStorage';
import { authApi } from '../api/auth';
import { setAuthTokenProvider, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

// Rotate this far before the access token actually expires. Refreshing after
// the fact costs a wasted round trip — and for a scan that round trip is the
// whole photo, uploaded twice.
const REFRESH_SKEW_MS = 60000;

function isUsable(tokens, now = Date.now()) {
  if (!tokens?.access_token) return false;
  // No recorded deadline (a session stored before we tracked one) — assume it's
  // good and let a 401 correct us.
  if (typeof tokens.expires_at !== 'number') return true;
  return now < tokens.expires_at - REFRESH_SKEW_MS;
}

// DEV ONLY. When true (and running a dev build), skip Google sign-in and enter
// the app with a fake session — lets you debug the UI/screens without OAuth
// credentials. Gated by __DEV__ so it can NEVER take effect in a release build.
// Turn this back to false once the real Google client IDs are wired in.
const DEV_BYPASS_AUTH = true;

// ...and never under jest, where __DEV__ is also true: the auth tests assert
// the real sign-in flow, and a debugging shortcut should not be able to decide
// whether they pass.
const bypassAuth = () => __DEV__ && DEV_BYPASS_AUTH && typeof jest === 'undefined';

/**
 * The `name` claim out of a Google ID token.
 *
 * There is no profile endpoint on the backend, and the ID token already
 * carries the user's name — so read it once at sign-in rather than adding a
 * round trip. This does NOT verify the token: the backend does that in
 * POST /auth/google, and by the time we get here it has already accepted it.
 * The value is only ever used to say hello.
 */
export function nameFromIdToken(idToken) {
  try {
    const payload = String(idToken).split('.')[1];
    if (!payload) return null;
    const json = decodeBase64Url(payload);
    const claims = JSON.parse(json);
    return claims.given_name ?? claims.name ?? null;
  } catch {
    return null;
  }
}

// Hermes has atob, but the JWT payload is base64url and may carry non-ASCII
// (a name with an accent), so unescape the percent-encoded bytes back to UTF-8.
function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = globalThis.atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return decodeURIComponent(
    raw
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
}

const DEV_FAKE_TOKENS = {
  access_token: 'dev-access',
  refresh_token: 'dev-refresh',
  token_type: 'bearer',
  expires_in: 3600,
};

export function AuthProvider({ children }) {
  // 'loading' until we know whether a session was persisted.
  const [status, setStatus] = useState('loading');
  const [tokens, setTokens] = useState(null);
  // Read off the Google ID token at sign-in; there is no profile endpoint.
  const [profileName, setProfileName] = useState(null);
  // True while the session is the DEV_BYPASS_AUTH fake one. Anything that would
  // call an authenticated endpoint has to sit it out: the fake tokens 401, and
  // apiFetch answers a 401 by rotating the session — which fails too, and signs
  // the developer straight back out.
  const [devSession, setDevSession] = useState(false);

  // apiFetch reads the access token through a registered provider rather than
  // importing this context (it isn't a component). The ref keeps that provider
  // reading current tokens without re-registering on every rotation.
  const tokensRef = useRef(null);
  tokensRef.current = tokens;

  // Write the ref synchronously alongside the state: after a refresh, apiFetch
  // reads the token back through the provider on the very next line, long
  // before React re-renders this provider.
  function applyTokens(next) {
    tokensRef.current = next;
    setTokens(next);
  }

  // One rotation at a time. The proactive path below and apiFetch's 401 handler
  // can both ask at once; without this they'd race and the loser would spend an
  // already-rotated refresh token, which the backend rejects.
  const rotationRef = useRef(null);

  useEffect(() => {
    setAuthTokenProvider(currentAccessToken);
    setUnauthorizedHandler(refreshSession);
  }, []);

  // apiFetch awaits this before every request, so a token that is about to
  // expire is rotated *here* rather than surfacing as a 401 and forcing the
  // whole request — a multi-megabyte photo included — to be sent twice.
  async function currentAccessToken() {
    const current = tokensRef.current;
    if (!current?.access_token) return null;
    if (isUsable(current)) return current.access_token;
    try {
      const rotated = await refreshSession();
      return rotated?.access_token ?? null;
    } catch {
      // The session is gone; refreshSession has already cleared it. Let the
      // request go out unauthenticated and report the 401 it earns.
      return null;
    }
  }

  useEffect(() => {
    // Dev escape hatch: pretend we have a session so AuthGate renders the app.
    // The fake tokens 401 against any authenticated endpoint, and apiFetch
    // answers a 401 by rotating the session — which fails too and would sign
    // the developer straight back out. `devSession` tells callers (the garden's
    // sync) to sit this one out rather than find that out the hard way.
    if (bypassAuth()) {
      applyTokens(DEV_FAKE_TOKENS);
      setDevSession(true);
      setStatus('signedIn');
      return;
    }

    let cancelled = false;
    loadTokens().then((stored) => {
      if (cancelled) return;
      if (stored) {
        applyTokens(stored);
        setProfileName(stored.name ?? null);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Exchange a Google ID token for app tokens, persist, and flip to signedIn.
  // Throws on failure so the Login screen can surface an error.
  async function completeGoogleLogin(idToken) {
    const minted = withExpiry(await authApi.loginGoogle(idToken));
    // Kept alongside the tokens so the greeting survives a relaunch — the app
    // tokens the backend mints carry no name of their own.
    const name = nameFromIdToken(idToken);
    await saveTokens({ ...minted, name });
    applyTokens(minted);
    setProfileName(name);
    setDevSession(false);
    setStatus('signedIn');
  }

  // Rotate the session with the stored refresh token (backend rotates it too).
  // Persists the whole new token set and returns it; on rejection (expired /
  // reused refresh token) the session is cleared. Registered above as apiFetch's
  // 401 handler, so any authenticated call (scans, garden, reminders) rotates
  // and replays once through this.
  function refreshSession() {
    if (!rotationRef.current) {
      rotationRef.current = rotate().finally(() => {
        rotationRef.current = null;
      });
    }
    return rotationRef.current;
  }

  async function rotate() {
    try {
      const rotated = withExpiry(await authApi.refresh(tokensRef.current?.refresh_token));
      // The refresh response has no name; carry the stored one forward.
      await saveTokens({ ...rotated, name: profileName ?? null });
      applyTokens(rotated);
      setStatus('signedIn');
      return rotated;
    } catch (e) {
      await clearTokens();
      applyTokens(null);
      setStatus('signedOut');
      throw e;
    }
  }

  // Best-effort server logout (ignore its errors), then clear local storage and
  // flip to signedOut. Not wired to any UI control yet (out of scope this pass).
  async function signOut() {
    try {
      const refresh = tokensRef.current?.refresh_token;
      if (refresh) await authApi.logout(refresh);
    } catch { }
    await clearTokens();
    applyTokens(null);
    setProfileName(null);
    setStatus('signedOut');
  }

  const value = {
    status,
    tokens,
    profileName,
    devSession,
    completeGoogleLogin,
    refreshSession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
