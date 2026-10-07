// What the free plan has left, read off the entitlement.
//
// The server is the gate (it answers 402 at the limit); these only decide what
// to show before a request is wasted on a sure "no". Every selector answers
// "no limit" while the plan is unknown or Plus, so nobody paying is ever shown
// a pitch on a stale or missing answer. `limits`/`usage` stay snake_case as
// GET /users/me/subscription sends them (api/billing.js mapEntitlement); a
// `null` limit means unlimited.

const isFree = (ent) => ent?.ready === true && ent?.isPlus !== true;

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0);

/** `{ limit, used, left, resetsAt }` for today's identifications, or null when unlimited. */
export function scanQuota(ent) {
  const limit = ent?.limits?.scans_per_day;
  if (!isFree(ent) || !Number.isFinite(limit)) return null;
  const used = Math.min(count(ent?.usage?.scans_today), limit);
  return { limit, used, left: limit - used, resetsAt: ent?.usage?.scans_reset_at ?? null };
}

/**
 * `{ limit, used, reached }` for the garden, or null when unlimited.
 * `ownedCount` is the live garden: the cached usage lags behind an add.
 */
export function plantQuota(ent, ownedCount = 0) {
  const limit = ent?.limits?.plants;
  if (!isFree(ent) || !Number.isFinite(limit)) return null;
  const used = Math.max(count(ent?.usage?.plants), count(ownedCount));
  return { limit, used, reached: used >= limit };
}

/** Whether the user may write their own reminders (free accounts get the default three). */
export function canCustomReminders(ent) {
  return !isFree(ent) || ent?.limits?.custom_reminders !== false;
}

/** Whether `e` is the server refusing for the plan — optionally for one `reason`. */
export function isPaywallError(e, reason) {
  if (e?.code !== 'paywall' && e?.status !== 402) return false;
  return reason == null || e?.paywall?.reason === reason;
}
