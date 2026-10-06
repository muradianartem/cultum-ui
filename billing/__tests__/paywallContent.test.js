import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  cachedPaywall,
  paywallStatus,
  prefetchPaywall,
  usePaywallResource,
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

describe('status', () => {
  // A probe that records every value the hook hands out.
  const mountResource = () => {
    const seen = [];
    let latest;
    function Probe() {
      latest = usePaywallResource();
      seen.push(latest.status);
      return null;
    }
    let tree;
    act(() => {
      tree = TestRenderer.create(<Probe />);
    });
    return { seen, current: () => latest, unmount: () => act(() => tree.unmount()) };
  };
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  test('reads loading before the first request and while one is in flight', () => {
    expect(paywallStatus()).toBe('loading');
    getPaywall.mockReturnValue(new Promise(() => {}));
    prefetchPaywall();
    expect(paywallStatus()).toBe('loading');
  });

  test('a failure notifies the screen and reads as error', async () => {
    const d = deferred();
    getPaywall.mockReturnValue(d.promise);
    const probe = mountResource();
    expect(probe.current().status).toBe('loading');

    await act(async () => {
      d.reject(new Error('offline'));
    });
    expect(paywallStatus()).toBe('error');
    expect(probe.current()).toMatchObject({ content: null, status: 'error' });
    probe.unmount();
  });

  test('a malformed payload reads as error', async () => {
    getPaywall.mockResolvedValue(UNUSABLE);
    await prefetchPaywall();
    expect(paywallStatus()).toBe('error');
  });

  test('retry goes loading, then ready', async () => {
    getPaywall.mockRejectedValue(new Error('offline'));
    const probe = mountResource();
    await act(async () => {});
    expect(probe.current().status).toBe('error');

    const d = deferred();
    getPaywall.mockReturnValue(d.promise);
    act(() => probe.current().retry());
    expect(probe.current().status).toBe('loading');

    await act(async () => {
      d.resolve(RESPONSE);
    });
    expect(probe.current().status).toBe('ready');
    expect(probe.current().content.title).toBe(RESPONSE.title);
    probe.unmount();
  });

  test('concurrent retries make one request', async () => {
    getPaywall.mockRejectedValue(new Error('offline'));
    const probe = mountResource();
    await act(async () => {});
    getPaywall.mockClear();

    const d = deferred();
    getPaywall.mockReturnValue(d.promise);
    act(() => {
      probe.current().retry();
      probe.current().retry();
      probe.current().retry();
    });
    expect(getPaywall).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve(RESPONSE);
    });
    expect(probe.current().status).toBe('ready');
    probe.unmount();
  });
});
