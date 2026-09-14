// Whether the app opens on the paywall, and when.
//
// One constant decides it, so narrowing this to real behaviour later — or
// pulling the paywall out of a build entirely — is a one-word edit rather than
// an archaeology exercise across App.js and AuthProvider.
//
// Today it is 'every-launch', deliberately: this is a test configuration, and
// the app is rarely signed out, so keying on a fresh sign-in would mean almost
// never seeing the screen.

/** 'every-launch' | 'fresh-login' | 'never' */
export const PAYWALL_ON_ENTRY = 'every-launch';

/**
 * The route <Router> should mount on, or null for the normal landing screen.
 *
 * @param {object} o
 * @param {'login'|'restore'|'dev'|null} o.signedInVia  how the session began
 *   ('login' = Google/Apple just completed, 'restore' = tokens off disk)
 * @param {string} [o.mode]  override, for tests
 */
export function paywallEntryRoute({ signedInVia, mode = PAYWALL_ON_ENTRY } = {}) {
  if (!signedInVia) return null;
  if (mode === 'every-launch') return 'paywall';
  if (mode === 'fresh-login') return signedInVia === 'login' ? 'paywall' : null;
  return null; // 'never', and anything unrecognised
}
