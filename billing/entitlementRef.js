// The current entitlement, readable synchronously from outside React.
//
// routing/guards.js are pure `(context) => boolean` functions with no context
// access — that is the whole point of the guard signature — so the one thing
// they need from the provider has to reach them some other way. Same shape as
// api/client.js's setAuthTokenProvider: a module singleton the provider writes
// synchronously, alongside its setState, so a guard evaluated in the same tick
// already sees it.

const UNKNOWN = { ready: false, plan: 'free', isPlus: false };

let current = UNKNOWN;

export function setEntitlement(next) {
  current = next ?? UNKNOWN;
}

export function currentEntitlement() {
  return current;
}

/** True only when the server has actually said so. */
export function isPlus() {
  return current.isPlus === true;
}

/** Whether we know anything at all yet — see requireSubscription. */
export function entitlementReady() {
  return current.ready === true;
}

/** Test seam. */
export function resetEntitlement() {
  current = UNKNOWN;
}
