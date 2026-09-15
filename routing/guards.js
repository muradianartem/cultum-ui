import { entitlementReady, isPlus } from '../billing/entitlementRef';

/**
 * Route guards — pluggable access checks for <Route guard={...}>.
 *
 * A guard is `(context) => boolean` where returning `false` blocks the route
 * (Route then shows its `fallback`). `context` is
 * `{ route, params, navigate, replace, back }`, so a guard can also redirect or
 * open a paywall as a side effect.
 *
 * Note guards run during render (routing/Route.js), so they must stay pure —
 * never navigate from one; that is what `fallback` is for.
 */

/**
 * Gate a route behind an active subscription.
 *
 * Reads billing/entitlementRef.js — a module singleton the EntitlementProvider
 * writes synchronously — rather than a context, because a guard has no access
 * to one and gains nothing by becoming a component.
 *
 * Fails OPEN until the answer is known. The provider hydrates from a disk cache
 * so that window is empty on every launch after the first, and on the very
 * first one a second of access costs nothing: the server gates the premium data
 * itself, whereas showing a paywall to a subscriber is a visible bug. The guard
 * re-runs on its own when the answer lands — the provider sits above <Router>,
 * so its state change re-renders <Route>.
 */
export function requireSubscription() {
  if (!entitlementReady()) return true;
  return isPlus();
}

/**
 * Gate a route behind being signed in.
 * TODO: replace with a real session check.
 */
export function requireAuth(context) {
  console.log(`[guard:auth] "${context.route}" requires sign-in — allowing (stub)`);
  return true;
}
