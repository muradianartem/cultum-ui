// What StoreKit says a subscription costs, and whether it comes with a free
// trial this user can actually get — reduced to the strings the paywall shows.
//
// Pure on purpose: it takes expo-iap's ProductSubscriptionIOS as plain data, so
// every storefront and offer shape can be tested without StoreKit.
//
// StoreKit owns price and trial terms; the backend owns names, features and
// timeline copy. Anything this cannot read confidently comes back as "no
// trial" — an unknown is never turned into a promise.

const PERIOD_UNITS = new Set(['day', 'week', 'month', 'year']);
const TRIAL_UNIT_DAYS = { day: 1, week: 7, month: 30 };

function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function plural(count, unit) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** `1 month` → 'month', `3 month` → '3 months', `1 year` → 'year'. */
function periodLabelOf(subscription) {
  const count = positiveInt(subscription?.subscriptionPeriodNumberIOS);
  const unit = subscription?.subscriptionPeriodUnitIOS;
  if (!count || !PERIOD_UNITS.has(unit)) return null;
  return count === 1 ? unit : plural(count, unit);
}

function trialOf(subscription) {
  if (subscription?.introductoryPricePaymentModeIOS !== 'free-trial') return null;
  const count = positiveInt(subscription.introductoryPriceNumberOfPeriodsIOS);
  const unit = subscription.introductoryPriceSubscriptionPeriodIOS;
  if (!count || !Object.hasOwn(TRIAL_UNIT_DAYS, unit ?? '')) return null;
  // `days` is for display only; the label keeps StoreKit's own unit, so a
  // one-month trial never reads as "30 days".
  return { days: count * TRIAL_UNIT_DAYS[unit], label: `${plural(count, unit)} free` };
}

/**
 * @param {object} subscription  expo-iap ProductSubscriptionIOS
 * @param {{ eligible: boolean|undefined }} options  intro-offer eligibility for
 *   the product's group; anything but `true` (unknown, failed) means no trial
 * @returns {{ displayPrice: string, periodLabel: string|null,
 *             trial: { days: number, label: string } | null }}
 */
export function storeTerms(subscription, { eligible } = {}) {
  return {
    // Passed through verbatim: StoreKit has already localized it ("4,99 €").
    displayPrice: subscription?.displayPrice ?? '',
    periodLabel: periodLabelOf(subscription),
    trial: eligible === true ? trialOf(subscription) : null,
  };
}

/**
 * The line above the CTA, from StoreKit's terms. `fallback` is the backend
 * product, whose `period` stands in when StoreKit's period is unreadable.
 */
export function headline(terms, fallback) {
  const period = terms.periodLabel ?? fallback?.period;
  // "a year", but "every 3 months".
  const price = `${terms.displayPrice} ${/^\d/.test(period ?? '') ? 'every' : 'a'} ${period}`;
  return terms.trial ? `${terms.trial.label}, then ${price}` : price;
}
