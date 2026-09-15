import { requireSubscription } from '../guards';
import { resetEntitlement, setEntitlement } from '../../billing/entitlementRef';

afterEach(resetEntitlement);

test('fails open until the server has said anything', () => {
  // The first launch on a new install has no cached answer. A second of access
  // costs nothing — the server gates the premium data itself — whereas showing
  // a paywall to somebody already paying is a visible bug.
  expect(requireSubscription({ route: 'premium-gallery' })).toBe(true);
});

test('blocks a free plan and admits a Plus one', () => {
  setEntitlement({ ready: true, plan: 'free', isPlus: false });
  expect(requireSubscription({ route: 'premium-gallery' })).toBe(false);

  setEntitlement({ ready: true, plan: 'plus', isPlus: true });
  expect(requireSubscription({ route: 'premium-gallery' })).toBe(true);
});

test('a ready answer that does not say Plus is not Plus', () => {
  setEntitlement({ ready: true, plan: 'plus', isPlus: undefined });
  expect(requireSubscription({ route: 'premium-gallery' })).toBe(false);
});
