// Product analytics, through PostHog. The one module the app talks to, so
// screens never import posthog-react-native and the vendor stays swappable.
//
// Every call is fire-and-forget and can never throw into the caller: a
// tracking bug must not break a save, a purchase or a sign-in. With no project
// key (POSTHOG_KEY in lib/config.js) or under jest, there is no client and
// every call is a no-op.
//
// Privacy: send ids, species keys, counts and enums only. Never plant or room
// names, feedback text, photos, or the user's email or name.

import { POSTHOG_KEY, POSTHOG_HOST } from './config';

let client; // undefined = not resolved yet, null = analytics off

function makeClient() {
  if (!POSTHOG_KEY || typeof jest !== 'undefined') return null;
  // Required lazily, so a build without a key never loads the SDK.
  const { PostHog } = require('posthog-react-native');
  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Application Opened / Backgrounded / Installed / Updated.
    captureAppLifecycleEvents: true,
    // No profiles for signed-out traffic (the Login screen); a person exists
    // once identify() runs.
    personProfiles: 'identified_only',
    enableSessionReplay: false,
  });
}

function get() {
  if (client === undefined) {
    try {
      client = makeClient();
    } catch (e) {
      if (__DEV__) console.warn('[analytics] PostHog failed to start', e);
      client = null;
    }
  }
  return client;
}

function safely(fn) {
  const c = get();
  if (!c) return;
  try {
    fn(c);
  } catch (e) {
    if (__DEV__) console.warn('[analytics]', e);
  }
}

/** Start the client early (App.js), so lifecycle events catch the cold launch. */
export function initAnalytics() {
  get();
}

/** Record an event. `props` must be free of personal data (see the header). */
export function track(event, props) {
  safely((c) => c.capture(event, props));
}

/** A screen view. `name` is the route name. */
export function screen(name, props) {
  safely((c) => c.screen(name, props));
}

/** Tie this device's events to a signed-in user. `userId` is the backend user id. */
export function identify(userId, traits) {
  if (!userId) return;
  safely((c) => c.identify(String(userId), traits));
}

/** Properties sent with every later event (plan, plants_count, …). */
export function setSuperProperties(props) {
  safely((c) => c.register(props));
}

/** Forget the user on sign-out, so the next account starts a fresh identity. */
export function resetAnalytics() {
  safely((c) => c.reset());
}

/** Tests only: swap the client for a fake (or null), bypassing the key check. */
export function __setAnalyticsClient(fake) {
  client = fake;
}
