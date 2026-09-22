// The paywall's content, cached at module scope.
//
// Module scope rather than a provider on purpose: AuthGate swaps <LoginScreen>
// for <Router> the instant a session appears, so anything held in a component
// mounted under Login is destroyed at exactly the moment the prefetched copy is
// needed. A module-level cache outlives that swap.
//
// Nothing is bundled. `cachedPaywall()` is null until the backend has answered,
// and stays null if it never does — the app does not ship a copy of prices it
// would then have to keep in step with the server. That is what makes
// PaywallLauncher, not <Router initial>, the thing that opens the screen: a
// paywall with no payload has nothing to sell, so it is not shown at all.

import { useEffect, useState } from 'react';
import { getPaywall, mapPaywall } from '../api/billing';

let cached = null; // last good remote content, or null if there has not been one
let inflight = null; // dedupes concurrent prefetches
let failed = false; // the last attempt ended without usable content
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

/** The content the backend gave us, or null if it has not yet. */
export function cachedPaywall() {
  return cached;
}

/**
 * Where the content stands, for a screen that has to draw something meanwhile.
 * With no cache, no request and no failure on record, a fetch is about to start
 * on mount — so that reads as loading too.
 *
 * @returns {'ready' | 'loading' | 'error'}
 */
export function paywallStatus() {
  if (cached) return 'ready';
  if (inflight) return 'loading';
  return failed ? 'error' : 'loading';
}

/**
 * Warm the cache. Fire-and-forget: it swallows every failure, and a rejection
 * simply leaves the cache empty (and `paywallStatus()` at 'error').
 *
 * Called from the Login screen (where the OAuth round trip pays for the
 * backend's cold start) and by anything that mounts `usePaywallContent`. They
 * collapse into one request.
 *
 * Returns the in-flight promise so tests can await it; callers should not.
 */
export function prefetchPaywall() {
  if (cached) return Promise.resolve();
  if (inflight) return inflight;
  failed = false;
  inflight = getPaywall()
    .then((dto) => {
      const mapped = mapPaywall(dto);
      if (!mapped) {
        failed = true; // malformed — as good as no answer
        return;
      }
      cached = mapped;
    })
    .catch(() => {
      failed = true;
    })
    .finally(() => {
      inflight = null;
      // Every outcome, not just success: a screen waiting on this has to learn
      // that it failed as much as that it landed.
      notify();
    });
  return inflight;
}

/** The content, or null until the backend has answered. Fetches on mount. */
export function usePaywallContent() {
  const [content, setContent] = useState(cachedPaywall);

  useEffect(() => {
    const onChange = () => setContent(cachedPaywall());
    listeners.add(onChange);
    // One more attempt per mount (never a loop): the Login prefetch may have
    // failed, or never run at all on a restored session.
    prefetchPaywall();
    // ...and it may have landed between the first render and this effect.
    if (cachedPaywall() !== content) onChange();
    return () => listeners.delete(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return content;
}

/**
 * The content plus where it stands, for a screen that renders every state
 * rather than waiting for content (PaywallScreen). `retry` refetches and flips
 * the status to 'loading' straight away.
 *
 * @returns {{ content: object|null, status: 'ready'|'loading'|'error', retry: () => void }}
 */
export function usePaywallResource() {
  const read = () => ({ content: cachedPaywall(), status: paywallStatus() });
  const [snapshot, setSnapshot] = useState(read);

  useEffect(() => {
    const onChange = () =>
      setSnapshot((prev) => {
        const next = read();
        return next.content === prev.content && next.status === prev.status ? prev : next;
      });
    listeners.add(onChange);
    prefetchPaywall();
    onChange(); // the request may have started, landed or failed since first render
    return () => listeners.delete(onChange);
  }, []);

  const retry = () => {
    prefetchPaywall();
    notify();
  };

  return { ...snapshot, retry };
}

/** Test seam. Listeners are left alone — mounted components still own theirs. */
export function __resetPaywallCache() {
  cached = null;
  inflight = null;
  failed = false;
}
