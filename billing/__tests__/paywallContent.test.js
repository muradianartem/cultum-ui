import {
  cachedPaywall,
  prefetchPaywall,
  __resetPaywallCache,
} from '../paywallContent';

jest.mock('../../api/billing', () => ({
  ...jest.requireActual('../../api/billing'),
  getPaywall: jest.fn(),
}));
const { getPaywall } = require('../../api/billing');

// This file only asks "has the backend answered yet?", so the answer needs to
// be a payload the mapper accepts and nothing more.
const RESPONSE = {
  title: 'Cultum Plus, free for 7 days',
  trial_days: 7,
  timeline: [{ day: 0, label: 'Today', title: 'Full access', body: 'Everything on.' }],
  features: [{ key: 'plants', label: 'Unlimited plants', free: '5 plants', plus: null }],
  products: [
    {
      key: 'yearly',
      label: 'Yearly',
      period: 'year',
      fallback_price: '$39.99',
      trial_days: 7,
      default: true,
    },
  ],
  footnote: 'Cancel any time.',
};
const UNUSABLE = { ...RESPONSE, products: [] };

beforeEach(() => {
  __resetPaywallCache();
  jest.clearAllMocks();
});

test('has nothing to offer until the backend answers', () => {
  expect(cachedPaywall()).toBeNull();
});

test('serves the payload once it lands', async () => {
  getPaywall.mockResolvedValue(RESPONSE);
  await prefetchPaywall();
  expect(cachedPaywall().title).toBe(RESPONSE.title);
});

test('concurrent prefetches collapse into one request', async () => {
  let resolve;
  getPaywall.mockReturnValue(new Promise((r) => { resolve = r; }));
  const a = prefetchPaywall();
  const b = prefetchPaywall();
  expect(getPaywall).toHaveBeenCalledTimes(1);
  resolve(RESPONSE);
  await Promise.all([a, b]);
  expect(getPaywall).toHaveBeenCalledTimes(1);
});

// Write-once is load-bearing: PaywallScreen and ChoosePlanSheet both assume
// their content cannot change underneath them.
test('a warm cache is never refetched or replaced', async () => {
  getPaywall.mockResolvedValue(RESPONSE);
  await prefetchPaywall();
  const first = cachedPaywall();

  getPaywall.mockResolvedValue({ ...RESPONSE, title: 'Something else entirely' });
  await prefetchPaywall();
  expect(getPaywall).toHaveBeenCalledTimes(1);
  expect(cachedPaywall()).toBe(first);
});

test('a rejection leaves the cache empty and never throws', async () => {
  getPaywall.mockRejectedValue(Object.assign(new Error('offline'), { code: 'offline' }));
  await expect(prefetchPaywall()).resolves.toBeUndefined();
  expect(cachedPaywall()).toBeNull();

  // ...and the next attempt is allowed to try again.
  getPaywall.mockResolvedValue(RESPONSE);
  await prefetchPaywall();
  expect(cachedPaywall()).not.toBeNull();
});

test('a malformed 200 is treated exactly like a failure', async () => {
  getPaywall.mockResolvedValue(UNUSABLE);
  await prefetchPaywall();
  expect(cachedPaywall()).toBeNull();
});
