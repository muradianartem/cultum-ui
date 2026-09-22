import { headline, storeTerms } from '../storeTerms';

// expo-iap ProductSubscriptionIOS, trimmed to the fields storeTerms reads.
const sub = (overrides = {}) => ({
  id: 'com.cultum.plus.monthly',
  displayPrice: '$4.99',
  subscriptionGroupIdIOS: '21500000',
  subscriptionPeriodNumberIOS: '1',
  subscriptionPeriodUnitIOS: 'month',
  introductoryPricePaymentModeIOS: 'free-trial',
  introductoryPriceNumberOfPeriodsIOS: '7',
  introductoryPriceSubscriptionPeriodIOS: 'day',
  ...overrides,
});
const MONTHLY = { key: 'monthly', period: 'month', fallbackPrice: '$5.99' };

test('a CAD storefront shows StoreKit’s price and the trial', () => {
  const terms = storeTerms(sub(), { eligible: true });
  expect(terms).toEqual({
    displayPrice: '$4.99',
    periodLabel: 'month',
    trial: { days: 7, label: '7 days free' },
  });
  expect(headline(terms, MONTHLY)).toBe('7 days free, then $4.99 a month');
});

test('a EUR price is passed through verbatim', () => {
  const terms = storeTerms(sub({ displayPrice: '4,99 €' }), { eligible: true });
  expect(terms.displayPrice).toBe('4,99 €');
  expect(headline(terms, MONTHLY)).toBe('7 days free, then 4,99 € a month');
});

test('a one-week trial keeps StoreKit’s unit in the label', () => {
  const terms = storeTerms(
    sub({ introductoryPriceNumberOfPeriodsIOS: '1', introductoryPriceSubscriptionPeriodIOS: 'week' }),
    { eligible: true }
  );
  expect(terms.trial).toEqual({ days: 7, label: '1 week free' });
});

test('a one-month trial is never relabelled as 30 days', () => {
  const terms = storeTerms(
    sub({ introductoryPriceNumberOfPeriodsIOS: '1', introductoryPriceSubscriptionPeriodIOS: 'month' }),
    { eligible: true }
  );
  expect(terms.trial).toEqual({ days: 30, label: '1 month free' });
});

test('a paid intro offer is not a free trial', () => {
  for (const mode of ['pay-as-you-go', 'pay-up-front', 'empty']) {
    const terms = storeTerms(sub({ introductoryPricePaymentModeIOS: mode }), { eligible: true });
    expect(terms.trial).toBeNull();
    expect(headline(terms, MONTHLY)).toBe('$4.99 a month');
  }
});

test('an ineligible or unknown user is promised nothing', () => {
  expect(storeTerms(sub(), { eligible: false }).trial).toBeNull();
  expect(storeTerms(sub(), { eligible: undefined }).trial).toBeNull();
  expect(storeTerms(sub(), {}).trial).toBeNull();
});

test('a 3-month period is named in full', () => {
  const terms = storeTerms(sub({ subscriptionPeriodNumberIOS: '3' }), { eligible: false });
  expect(terms.periodLabel).toBe('3 months');
  expect(headline(terms, MONTHLY)).toBe('$4.99 every 3 months');
});

test('a yearly period reads as "year"', () => {
  const terms = storeTerms(sub({ subscriptionPeriodUnitIOS: 'year' }), { eligible: false });
  expect(terms.periodLabel).toBe('year');
});

test('missing fields fall back to the backend period and no trial', () => {
  const terms = storeTerms({ id: 'x', displayPrice: '$4.99', introductoryPricePaymentModeIOS: 'free-trial' }, {
    eligible: true,
  });
  expect(terms).toEqual({ displayPrice: '$4.99', periodLabel: null, trial: null });
  expect(headline(terms, MONTHLY)).toBe('$4.99 a month');

  const bogus = storeTerms(
    sub({ introductoryPriceNumberOfPeriodsIOS: '0', subscriptionPeriodUnitIOS: 'empty' }),
    { eligible: true }
  );
  expect(bogus.trial).toBeNull();
  expect(bogus.periodLabel).toBeNull();
});
