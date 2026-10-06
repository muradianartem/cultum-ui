// Auth session state + the token exchange/persistence orchestration. Acquiring
// the provider ID token (Google's useAuthRequest hook, Apple's signInAsync)
// lives in the Login screen, not here — this provider only owns exchange +
// storage.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadTokens, saveTokens, clearTokens, withExpiry } from '../lib/authStorage';
import { authApi } from '../api/auth';
import { getMe } from '../api/account';
import { ApiError, setAuthTokenProvider, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

// Rotate this far before the access token actually expires. Refreshing after
// the fact costs a wasted round trip — and for a scan that round trip is the
// whole photo, uploaded twice.
const REFRESH_SKEW_MS = 60000;

// How long a sign-in waits on GET /users/me before giving up on it. The answer
// only picks the first route; without it onboarding falls back to the record
// on this device, so a slow backend must not hold the user on the Login screen.
const ME_TIMEOUT_MS = 8000;

// What a rotation that outlived its session rejects with. The tokens it minted
// belong to nobody now, so the caller gets what it would have got signed out.
const staleRotation = () =>
  new ApiError('Session changed during refresh', { status: 401, code: 'unauthorized' });

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
const DEV_BYPASS_AUTH = false;

// ...and never under jest, where __DEV__ is also true: the auth tests assert
// the real sign-in flow, and a debugging shortcut should not be able to decide
// whether they pass.
const bypassAuth = () => __DEV__ && DEV_BYPASS_AUTH && typeof jest === 'undefined';

/**
 * The claims out of a provider ID token.
 *
 * The TokenResponse the backend mints carries neither a name nor an email,
 * but the provider's ID token already has both, so read them once at sign-in.
 * (GET /users/me exists now, but is read only for `onboarding_shown`.)
 *
 * This does NOT verify the token: the backend does that in POST /auth/google
 * and POST /auth/apple, and by the time we get here it has already accepted
 * it. The values are only ever used to say hello, and to show the user which
 * account they are signed in to.
 *
 * Returns {} on anything malformed, so every reader below is a plain lookup.
 */
export function claimsFromIdToken(idToken) {
  try {
    const payload = String(idToken).split('.')[1];
    if (!payload) return {};
    return JSON.parse(decodeBase64Url(payload)) ?? {};
  } catch {
    return {};
  }
}

/** The user's given name, for the greeting. */
export function nameFromIdToken(idToken) {
  const claims = claimsFromIdToken(idToken);
  return claims.given_name ?? claims.name ?? null;
}

/**
 * The user's email.
 *
 * One extractor covers both providers, which is what makes this cheap. Unlike
 * the name — which Apple hands over exactly once, in the credential, and never
 * again — Apple's identity token carries `email` on *every* sign-in, and the
 * Login screen already requests the EMAIL scope. So nothing has to be plumbed
 * through the screen the way `firstNameOf(credential)` had to be.
 */
export function emailFromIdToken(idToken) {
  const email = claimsFromIdToken(idToken).email;
  return typeof email === 'string' && email ? email : null;
}

/**
 * Whether Apple's "Hide My Email" is in play (a @privaterelay.appleid.com
 * address). Shown verbatim either way — it is the address the user chose, and
 * the one that actually receives mail — but the UI may want to say so.
 */
export function emailIsPrivate(idToken) {
  const flag = claimsFromIdToken(idToken).is_private_email;
  return flag === true || flag === 'true';
}

/** The profile fields we keep beside the tokens, read off an ID token. */
function profileFromIdToken(idToken, name) {
  return {
    name: name ?? nameFromIdToken(idToken),
    email: emailFromIdToken(idToken),
    emailIsPrivate: emailIsPrivate(idToken),
  };
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
  // Read off the provider ID token at sign-in.
  const [profileName, setProfileName] = useState(null);
  const [profileEmail, setProfileEmail] = useState(null);
  const [profileEmailIsPrivate, setProfileEmailIsPrivate] = useState(false);
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

  // The profile travels with the tokens under one storage key, and every writer
  // re-serialises the whole record — so it has to be read from a ref, not from
  // render state. `rotate()` in particular is invoked from currentAccessToken
  // and from apiFetch's 401 handler, either of which can fire before this
  // provider re-renders after a name edit; reading `profileName` out of a stale
  // closure there would persist the old name, and re-saving only `name` would
  // drop the email on the first refresh — which happens within the hour.
  const profileRef = useRef({ name: null, email: null, emailIsPrivate: false });

  // Same synchronous-write discipline as applyTokens, for the same reason.
  function applyProfile(next) {
    profileRef.current = next;
    setProfileName(next.name ?? null);
    setProfileEmail(next.email ?? null);
    setProfileEmailIsPrivate(!!next.emailIsPrivate);
  }

  // One rotation at a time. The proactive path below and apiFetch's 401 handler
  // can both ask at once; without this they'd race and the loser would spend an
  // already-rotated refresh token, which the backend rejects.
  const rotationRef = useRef(null);

  // Bumped whenever a session begins or ends. A rotation remembers the value it
  // started under, and once that has moved on its result — success or failure —
  // belongs to a session that no longer exists and must change nothing.
  const sessionRef = useRef(0);

  // Every token write goes through one chain, in order. The generation check
  // stops a stale rotation from *starting* a save after sign-out, but a save
  // already under way when sign-out begins must still finish before the clear
  // does — otherwise it lands on disk last and restores the session on relaunch.
  const storageRef = useRef(Promise.resolve());
  function persist(write) {
    const done = storageRef.current.then(write, write);
    storageRef.current = done.catch(() => {});
    return done;
  }

  // A new generation: forget the old session's rotation so the next demand for
  // a token starts its own rather than joining a stale one.
  function nextSession() {
    sessionRef.current += 1;
    rotationRef.current = null;
  }

  // How the current session began — read by billing/entry.js to decide whether
  // the app opens on the paywall. A ref, written synchronously before the
  // setStatus that reveals the session, rather than a second piece of state:
  // AuthGate mounts <Router> on the render that flips `status`, and <Router>
  // reads its `initial` route exactly once, at that mount. A torn write (status
  // committed a render before the origin) would land the user on Today with no
  // way back to the paywall for the rest of the session.
  const originRef = useRef(null);

  // The account as GET /users/me returned it at sign-in, or null (a restored
  // session, the dev bypass, or a read that failed). A ref for the same reason
  // as `originRef`: <OnboardingProvider> reads `onboarding_shown` once, at the
  // mount that `setStatus('signedIn')` triggers.
  const accountRef = useRef(null);

  useEffect(() => {
    setAuthTokenProvider(currentAccessToken);
    setUnauthorizedHandler(refreshSession);
    // Registered once: both read the session through refs, so a stale closure
    // is harmless, and re-registering on every render would churn apiFetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // apiFetch awaits this before every request, so a token that is about to
  // expire is rotated *here* rather than surfacing as a 401 and forcing the
  // whole request — a multi-megabyte photo included — to be sent twice.
  async function currentAccessToken() {
    const current = tokensRef.current;
    if (!current?.access_token) return null;
    if (isUsable(current)) return current.access_token;
    // A failed rotation rejects here, before apiFetch sends anything: a request
    // that can't be authenticated is not worth sending, and the rotation's own
    // error (offline, timeout, 401) is what callers know how to classify.
    return (await refreshSession()).access_token;
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
      originRef.current = 'dev';
      setStatus('signedIn');
      return;
    }

    let cancelled = false;
    loadTokens().then((stored) => {
      if (cancelled) return;
      if (stored) {
        applyTokens(stored);
        // `email` is absent from a session established before it was recorded.
        // Null is the honest answer; the UI renders nothing rather than a
        // placeholder, and the next sign-in fills it in.
        applyProfile({
          name: stored.name ?? null,
          email: stored.email ?? null,
          emailIsPrivate: !!stored.emailIsPrivate,
        });
        originRef.current = 'restore';
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
    // Google's ID token carries both the name and the email, so read them here
    // rather than making the screen dig the claims out.
    await establishSession(
      await authApi.loginGoogle(idToken),
      profileFromIdToken(idToken),
    );
  }

  // Exchange an Apple identity token for app tokens. Unlike Google's, Apple's
  // token has no name claim: the name is handed to the *screen*, once, in the
  // credential, so it arrives as an argument here. It is `null` on every sign-in
  // after the first — see `loginApple` in api/auth.js.
  async function completeAppleLogin(idToken, name) {
    // The name arrives as an argument (Apple gives it once, in the credential);
    // the email is read from the token like Google's, because Apple *does* put
    // that claim in every identity token it issues.
    await establishSession(
      await authApi.loginApple(idToken, name),
      profileFromIdToken(idToken, name ?? null),
    );
  }

  async function establishSession(response, profile) {
    nextSession();
    const minted = withExpiry(response);
    // The profile is kept alongside the tokens so the greeting survives a
    // relaunch — the app tokens the backend mints carry neither field, and for
    // Apple this device is the only place the name is written down at all.
    applyProfile(profile);
    await persist(() => saveTokens({ ...minted, ...profile }));
    applyTokens(minted);
    setDevSession(false);
    const generation = sessionRef.current;
    const account = await readAccount();
    // A rejected refresh during that read already ended this session.
    if (generation !== sessionRef.current) throw staleRotation();
    accountRef.current = account;
    originRef.current = 'login';
    setStatus('signedIn');
  }

  // GET /users/me for the session just minted. Best-effort: it decides whether
  // onboarding shows, and on any failure the onboarding record on this device
  // decides instead — never a reason to fail the sign-in itself.
  async function readAccount() {
    try {
      return await getMe({ timeoutMs: ME_TIMEOUT_MS });
    } catch (e) {
      console.warn('[auth] GET /users/me failed:', e?.message ?? e);
      return null;
    }
  }

  // Rotate the session with the stored refresh token (backend rotates it too).
  // Persists the whole new token set and returns it. Only the backend rejecting
  // the refresh token (401) clears the session; a transient failure rejects with
  // its own error and leaves the session as it was. Registered above as apiFetch's
  // 401 handler, so any authenticated call (scans, garden, reminders) rotates
  // and replays once through this.
  function refreshSession() {
    if (!rotationRef.current) {
      // The rotation is deferred by a microtask so this ref is written *before*
      // rotate() runs. Assigning rotate()'s return value directly would leave the
      // ref null for the whole synchronous prefix of rotate() — and that prefix
      // reaches apiFetch, which used to ask for an access token, which asks here
      // again. With the guard not yet armed, that recursed until the stack blew
      // and the failure was mistaken for a rejected refresh token, signing the
      // user out on every cold launch. apiFetch no longer authenticates /auth/*,
      // but the lock has to be honest on its own.
      //
      // Unlock only if this rotation still holds the lock: a sign-out or re-login
      // in the meantime may have handed it to the new session's rotation.
      const rotation = Promise.resolve().then(rotate);
      rotationRef.current = rotation;
      rotation
        .finally(() => {
          if (rotationRef.current === rotation) rotationRef.current = null;
        })
        .catch(() => {});
    }
    return rotationRef.current;
  }

  async function rotate() {
    const generation = sessionRef.current;
    const refreshToken = tokensRef.current?.refresh_token;
    // Nothing to rotate with. Sending `refresh_token: undefined` would earn a 422
    // and land in the same catch below, one pointless round trip later.
    if (!refreshToken) {
      await endSession();
      throw new ApiError('No refresh token to rotate', { status: 401, code: 'unauthorized' });
    }
    let rotated;
    try {
      rotated = withExpiry(await authApi.refresh(refreshToken));
    } catch (e) {
      // Signed out, or into another account, while this was in flight.
      if (generation !== sessionRef.current) throw e;
      // Only the backend refusing the refresh token ends the session. Offline, a
      // timeout, a 5xx — the token is still good, and signing out would wipe
      // the garden along with any writes still waiting to reach the server.
      if (e?.status === 401) await endSession();
      throw e;
    }
    if (generation !== sessionRef.current) throw staleRotation();
    // The refresh response carries no profile; carry the stored one forward.
    await persist(() => saveTokens({ ...rotated, ...profileRef.current }));
    if (generation !== sessionRef.current) throw staleRotation();
    applyTokens(rotated);
    // `originRef` is deliberately untouched: this fires mid-session with the
    // Router already mounted, and claiming a new origin here would re-arm the
    // paywall for a session the user is already inside.
    setStatus('signedIn');
    return rotated;
  }

  // Drop the session locally. Shared by a rejected rotation and by signOut, which
  // only adds the best-effort server-side revoke on top.
  async function endSession() {
    nextSession();
    await persist(clearTokens);
    applyTokens(null);
    originRef.current = null;
    accountRef.current = null;
    setStatus('signedOut');
  }

  // Best-effort server logout (ignore its errors), then clear local storage and
  // flip to signedOut. Not wired to any UI control yet (out of scope this pass).
  async function signOut() {
    // Before the logout round trip, so a rotation finishing during it is
    // already stale.
    nextSession();
    try {
      const refresh = tokensRef.current?.refresh_token;
      if (refresh) await authApi.logout(refresh);
    } catch { }
    applyProfile({ name: null, email: null, emailIsPrivate: false });
    await endSession();
  }

  /**
   * Rename the signed-in user, from the Edit profile sheet.
   *
   * Auth owns the name outright. GardenProvider mirrors `profileName` into the
   * garden document on every render, so a write that went only to the garden
   * would be overwritten by the mirror on the very next one — the edit would
   * appear to take and then snap back. There is exactly one writer, and this
   * is it.
   *
   * Device-local: there is no PATCH /users/me, and POST /auth/apple accepts a
   * name only at sign-in. Signing in on a second device shows the provider's
   * name again, not this one.
   */
  async function updateProfileName(name) {
    const clean = String(name ?? '').trim() || null;
    const next = { ...profileRef.current, name: clean };
    applyProfile(next);
    // Nothing to write beside, and the dev session's fake tokens are not worth
    // persisting.
    if (!tokensRef.current || devSession) return;
    await persist(() => saveTokens({ ...tokensRef.current, ...next }));
  }

  const value = {
    status,
    tokens,
    profileName,
    profileEmail,
    profileEmailIsPrivate,
    devSession,
    updateProfileName,
    signedInVia: originRef.current,
    // `onboarding_shown` from GET /users/me at sign-in: true, false, or null
    // when it was not asked (restore, dev) or could not be read.
    onboardingShown:
      typeof accountRef.current?.onboarding_shown === 'boolean'
        ? accountRef.current.onboarding_shown
        : null,
    completeGoogleLogin,
    completeAppleLogin,
    refreshSession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
