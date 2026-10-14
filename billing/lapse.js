// The end of a trial or a subscription, read off the entitlement.
//
// Figma "Trial ends" (998:726): a countdown on Today while a trial runs, then
// one full-screen notice once Plus has lapsed, and — when the garden is over
// the free plant limit — the one-time pick of the plant that keeps reminders.
//
// `subscription.status` alone cannot say a lapse happened. It is the store's
// last word, and a row the store never updated still reads `trialing` after its
// `expires_at`; the server re-checks that date on every request and answers
// `plan: free`. So the lapse signal is a free plan *with* a subscription (the
// server reports the most recent lapsed one), and the subscription only says
// what kind of thing ended. Like billing/limits.js, every selector answers
// "nothing to show" while the plan is unknown.

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const date = (v) => {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * `{ daysLeft, endsAt }` while a trial runs, else null. Calendar days in the
 * device's zone: 0 is "ends today", 1 "tomorrow". Shown for every trial,
 * whether or not it is set to renew.
 */
export function trialCountdown(ent, now = new Date()) {
  const sub = ent?.subscription;
  if (ent?.ready !== true || ent?.isPlus !== true || sub?.status !== 'trialing') return null;
  const endsAt = date(sub.trial_ends_at) ?? date(sub.expires_at);
  if (!endsAt || endsAt <= now) return null;
  const daysLeft = Math.max(0, Math.round((startOfDay(endsAt) - startOfDay(now)) / DAY_MS));
  return { daysLeft, endsAt };
}

/**
 * `{ kind, key }` once Plus has lapsed, else null.
 *
 * `kind` is 'trial' when what ended was a free trial — the server sets
 * `trial_ends_at` only on a row that was trialing — and 'plus' for a paid
 * subscription. `key` names this one lapse, so the notice is shown once per
 * lapse rather than once per account: a resubscribe that lapses again is news.
 */
export function planLapse(ent) {
  const sub = ent?.subscription;
  if (ent?.ready !== true || ent?.isPlus === true || !sub?.id) return null;
  return {
    kind: sub.trial_ends_at ? 'trial' : 'plus',
    key: `${sub.id}:${sub.expires_at ?? ''}`,
  };
}

/**
 * Whether to ask "Pick your free plant": free, over the plant limit (the server
 * only names a `freePlantId` then), and not picked yet — it can be picked once.
 */
export function needsFreePlantPick(ent) {
  return ent?.ready === true && ent?.isPlus !== true && !!ent?.freePlantId && !ent?.freePlantChosen;
}
