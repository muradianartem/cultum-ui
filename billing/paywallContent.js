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
const listeners = new Set();

/** The content the backend gave us, or null if it has not yet. */
export function cachedPaywall() {
  return cached;
}

/**
 * Warm the cache. Fire-and-forget: it swallows every failure, and a rejection
 * simply leaves the cache empty.
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
  inflight = getPaywall()
    .then((dto) => {
      const mapped = mapPaywall(dto);
      if (!mapped) return; // malformed — as good as no answer
      cached = mapped;
      for (const notify of listeners) notify();
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
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

/** Test seam. Listeners are left alone — mounted components still own theirs. */
export function __resetPaywallCache() {
  cached = null;
  inflight = null;
}
