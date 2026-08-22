/**
 * Route guards — pluggable access checks for <Route guard={...}>.
 *
 * A guard is `(context) => boolean` where returning `false` blocks the route
 * (Route then shows its `fallback`). `context` is
 * `{ route, params, navigate, replace, back }`, so a guard can also redirect or
 * open a paywall as a side effect.
 *
 * These are stubs for now — real logic (auth/subscription state) drops in behind
 * the same signature without touching any screen or <Route>.
 */

/**
 * Gate a route behind an active subscription.
 * TODO: replace the console.log with a real entitlement check (and return false
 * to block + route to a paywall when the user isn't subscribed).
 */
export function requireSubscription(context) {
  console.log(
    `[guard:subscription] "${context.route}" requires a subscription — allowing (stub)`
  );
  return true;
}

/**
 * Gate a route behind being signed in.
 * TODO: replace with a real session check.
 */
export function requireAuth(context) {
  console.log(`[guard:auth] "${context.route}" requires sign-in — allowing (stub)`);
  return true;
}
