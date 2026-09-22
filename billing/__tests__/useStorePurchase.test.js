import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// StoreKit is faked at the hook boundary: these tests hold the callbacks the
// hook hands useIAP and fire them the way the native module would.
const mockCallbacks = { current: null };
const mockIap = {
  connected: true,
  // What StoreKit resolved for the requested skus. `displayPrice` is the
  // localized string the paywall must show instead of the API's USD fallback.
  subscriptions: [],
  fetchProducts: jest.fn(async () => {}),
  requestPurchase: jest.fn(async () => {}),
  finishTransaction: jest.fn(async () => {}),
};
const mockGetAvailablePurchases = jest.fn(async () => []);
jest.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled', Pending: 'pending', DeferredPayment: 'deferred-payment' },
  // Both are wrapped rather than referenced: the factory runs while the module
  // under test is being required, which is before these consts initialize.
  getAvailablePurchases: (...args) => mockGetAvailablePurchases(...args),
  useIAP: (options) => {
    mockCallbacks.current = options;
    return mockIap;
  },
}));

const mockApply = jest.fn();
jest.mock('../EntitlementProvider', () => ({ useEntitlement: () => ({ apply: mockApply }) }));
jest.mock('../../api/billing', () => ({ verifyApplePurchase: jest.fn() }));
const { verifyApplePurchase } = require('../../api/billing');

// Jest resolves the .ios.js file (jest-expo's default platform), same as Metro on iOS.
import useStorePurchase, { PURCHASE_MESSAGES } from '../useStorePurchase';

const YEARLY = { key: 'yearly', appleProductId: 'com.cultum.plus.yearly' };
const MONTHLY = { key: 'monthly', appleProductId: 'com.cultum.plus.monthly' };

const PURCHASE = {
  id: '2000000123',
  transactionId: '2000000123',
  productId: 'com.cultum.plus.yearly',
  purchaseToken: 'eyJhbGciOiJFUzI1NiJ9.payload.signature',
  purchaseState: 'purchased',
};
const PLUS = { plan: 'plus', is_plus: true, limits: {}, usage: null, subscription: { status: 'trialing' } };

let hook;
let tree;
function Harness() {
  hook = useStorePurchase([YEARLY, MONTHLY]);
  return null;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockIap.connected = true;
  mockIap.subscriptions = [];
  mockGetAvailablePurchases.mockResolvedValue([]);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await act(async () => {
    tree = TestRenderer.create(<Harness />);
  });
});

afterEach(() => {
  act(() => tree.unmount());
  console.log.mockRestore();
});

// Start a purchase without awaiting it: it only resolves once StoreKit answers.
// Boxed, because an async helper returning the promise itself would adopt it
// and wait for the very answer the test has yet to send.
const startPurchase = async (product = YEARLY) => {
  const box = {};
  await act(async () => {
    box.result = hook.purchase(product);
  });
  return box;
};

test('resolves the subscription products once the store connects', () => {
  expect(mockIap.fetchProducts).toHaveBeenCalledWith({
    skus: ['com.cultum.plus.yearly', 'com.cultum.plus.monthly'],
    type: 'subs',
  });
});

test('a purchase is verified with its JWS, applied, then finished', async () => {
  verifyApplePurchase.mockResolvedValue(PLUS);
  const { result } = await startPurchase();

  expect(hook.busy).toBe(true);
  expect(mockIap.requestPurchase).toHaveBeenCalledWith({
    request: { apple: { sku: 'com.cultum.plus.yearly' } },
    type: 'subs',
  });

  await act(async () => {
    await mockCallbacks.current.onPurchaseSuccess(PURCHASE);
  });

  await expect(result).resolves.toBe(true);
  expect(verifyApplePurchase).toHaveBeenCalledWith({
    signedTransaction: PURCHASE.purchaseToken,
    transactionId: '2000000123',
  });
  expect(mockApply).toHaveBeenCalledWith(PLUS);
  expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: PURCHASE, isConsumable: false });
  // The backend has to have the transaction before StoreKit forgets it.
  expect(verifyApplePurchase.mock.invocationCallOrder[0]).toBeLessThan(
    mockIap.finishTransaction.mock.invocationCallOrder[0]
  );
  expect(hook.busy).toBe(false);
  expect(hook.error).toBeNull();
});

test('a cancelled sheet is silent and verifies nothing', async () => {
  const { result } = await startPurchase();
  await act(async () => {
    mockCallbacks.current.onPurchaseError({ code: 'user-cancelled', message: 'cancelled' });
  });

  await expect(result).resolves.toBe(false);
  expect(verifyApplePurchase).not.toHaveBeenCalled();
  expect(hook.busy).toBe(false);
  expect(hook.error).toBeNull();
});

test('a store failure says so', async () => {
  const { result } = await startPurchase();
  await act(async () => {
    mockCallbacks.current.onPurchaseError({ code: 'network-error', message: 'nope' });
  });
  await expect(result).resolves.toBe(false);
  expect(hook.error).toBe(PURCHASE_MESSAGES.failed);
});

test('a failed verify leaves the transaction unfinished so StoreKit replays it', async () => {
  verifyApplePurchase.mockRejectedValue(Object.assign(new Error('offline'), { code: 'offline' }));
  const { result } = await startPurchase();
  await act(async () => {
    await mockCallbacks.current.onPurchaseSuccess(PURCHASE);
  });

  await expect(result).resolves.toBe(false);
  expect(mockIap.finishTransaction).not.toHaveBeenCalled();
  expect(mockApply).not.toHaveBeenCalled();
  expect(hook.error).toBe(PURCHASE_MESSAGES.verifyOffline);
});

test('a purchase the backend says belongs to another account says so, not "we will retry"', async () => {
  verifyApplePurchase.mockRejectedValue(
    Object.assign(new Error('Already linked'), { code: 'http', status: 409 })
  );
  const { result } = await startPurchase();
  await act(async () => {
    await mockCallbacks.current.onPurchaseSuccess(PURCHASE);
  });

  await expect(result).resolves.toBe(false);
  expect(hook.error).toBe(PURCHASE_MESSAGES.alreadyLinked);
  // Still unfinished: the transaction is real and the *other* account owns it.
  expect(mockIap.finishTransaction).not.toHaveBeenCalled();
});

test('a replayed transaction with nobody waiting is still verified and finished', async () => {
  verifyApplePurchase.mockResolvedValue(PLUS);
  await act(async () => {
    await mockCallbacks.current.onPurchaseSuccess(PURCHASE);
  });
  expect(verifyApplePurchase).toHaveBeenCalledTimes(1);
  expect(mockApply).toHaveBeenCalledWith(PLUS);
  expect(mockIap.finishTransaction).toHaveBeenCalledTimes(1);
  expect(hook.error).toBeNull();
});

test('the same transaction delivered twice at once is verified once', async () => {
  let release;
  verifyApplePurchase.mockReturnValue(new Promise((r) => (release = r)));
  await act(async () => {
    mockCallbacks.current.onPurchaseSuccess(PURCHASE);
    mockCallbacks.current.onPurchaseSuccess(PURCHASE);
    release(PLUS);
  });
  expect(verifyApplePurchase).toHaveBeenCalledTimes(1);
});

test('with no store connection it refuses instead of hanging', async () => {
  mockIap.connected = false;
  let ok;
  await act(async () => {
    ok = await hook.purchase(YEARLY);
  });
  expect(ok).toBe(false);
  expect(mockIap.requestPurchase).not.toHaveBeenCalled();
  expect(hook.error).toBe(PURCHASE_MESSAGES.unavailable);
});

// StoreKit's state is read at render, so these remount rather than poke the
// live tree — which is also how the app sees it: the products resolve, useIAP
// re-renders, and the new prices are simply there.
const remount = async () => {
  act(() => tree.unmount());
  await act(async () => {
    tree = TestRenderer.create(<Harness />);
  });
};

describe('localized prices', () => {
  test('are empty until StoreKit has resolved the products', () => {
    expect(hook.prices).toEqual({});
  });

  test('expose displayPrice keyed by product id', async () => {
    mockIap.subscriptions = [
      { id: 'com.cultum.plus.yearly', displayPrice: '£34.99', currency: 'GBP' },
      { id: 'com.cultum.plus.monthly', displayPrice: '£4.99', currency: 'GBP' },
    ];
    await remount();
    // The storefront's own currency, which is the whole point — the API's
    // fallback_price would have said $39.99 to this user.
    expect(hook.prices).toEqual({
      'com.cultum.plus.yearly': '£34.99',
      'com.cultum.plus.monthly': '£4.99',
    });
  });

  test('skip a product StoreKit returned without a price', async () => {
    mockIap.subscriptions = [
      { id: 'com.cultum.plus.yearly', displayPrice: '£34.99' },
      { id: 'com.cultum.plus.monthly' },
    ];
    await remount();
    expect(hook.prices).toEqual({ 'com.cultum.plus.yearly': '£34.99' });
  });
});

describe('restore', () => {
  const restore = async () => {
    let ok;
    await act(async () => {
      ok = await hook.restore();
    });
    return ok;
  };

  test('verifies an owned subscription and applies what the backend answers', async () => {
    mockGetAvailablePurchases.mockResolvedValue([PURCHASE]);
    verifyApplePurchase.mockResolvedValue(PLUS);

    expect(await restore()).toBe(true);
    expect(verifyApplePurchase).toHaveBeenCalledWith({
      signedTransaction: PURCHASE.purchaseToken,
      transactionId: '2000000123',
    });
    expect(mockApply).toHaveBeenCalledWith(PLUS);
    // A restore is a purchase whose sheet was shown months ago, so it finishes
    // the transaction on the same terms: only once the backend has it.
    expect(mockIap.finishTransaction).toHaveBeenCalledWith({ purchase: PURCHASE, isConsumable: false });
    expect(hook.error).toBeNull();
    expect(hook.restoring).toBe(false);
  });

  test('says so when the Apple ID owns nothing', async () => {
    mockGetAvailablePurchases.mockResolvedValue([]);
    expect(await restore()).toBe(false);
    expect(verifyApplePurchase).not.toHaveBeenCalled();
    expect(hook.error).toBe(PURCHASE_MESSAGES.nothingToRestore);
  });

  test('an expired subscription restores but does not count as restored', async () => {
    // The receipt is genuine and verifies; Apple just is not billing for it any
    // more. Reporting success here would bounce the user off the paywall and
    // straight back onto Free.
    mockGetAvailablePurchases.mockResolvedValue([PURCHASE]);
    verifyApplePurchase.mockResolvedValue({ ...PLUS, plan: 'free', is_plus: false });

    expect(await restore()).toBe(false);
    expect(mockApply).toHaveBeenCalled();
    expect(hook.error).toBe(PURCHASE_MESSAGES.nothingToRestore);
  });

  test('a failed verify leaves the transaction unfinished here too', async () => {
    mockGetAvailablePurchases.mockResolvedValue([PURCHASE]);
    verifyApplePurchase.mockRejectedValue(Object.assign(new Error('offline'), { code: 'offline' }));

    expect(await restore()).toBe(false);
    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
    expect(mockApply).not.toHaveBeenCalled();
  });

  test('an unreachable store says so rather than claiming nothing was found', async () => {
    mockGetAvailablePurchases.mockRejectedValue(new Error('store down'));
    expect(await restore()).toBe(false);
    expect(hook.error).toBe(PURCHASE_MESSAGES.restoreFailed);
  });

  test('restores every owned subscription, and one grant is enough', async () => {
    const stale = { ...PURCHASE, id: '2000000001', transactionId: '2000000001' };
    mockGetAvailablePurchases.mockResolvedValue([stale, PURCHASE]);
    verifyApplePurchase
      .mockResolvedValueOnce({ ...PLUS, plan: 'free', is_plus: false })
      .mockResolvedValueOnce(PLUS);

    expect(await restore()).toBe(true);
    expect(verifyApplePurchase).toHaveBeenCalledTimes(2);
  });

  test('names the conflict when the subscription is on another account', async () => {
    // A household sharing one Apple ID. "Nothing to restore" would be a lie —
    // they are holding a live subscription — and "we'll retry" doubly so.
    mockGetAvailablePurchases.mockResolvedValue([PURCHASE]);
    verifyApplePurchase.mockRejectedValue(
      Object.assign(new Error('Already linked'), { code: 'http', status: 409 })
    );

    expect(await restore()).toBe(false);
    expect(hook.error).toBe(PURCHASE_MESSAGES.alreadyLinked);
    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
  });

  test('will not start under an open purchase sheet', async () => {
    await startPurchase();
    expect(await restore()).toBe(false);
    expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
  });

  test('with no store connection it refuses instead of hanging', async () => {
    mockIap.connected = false;
    await remount();
    expect(await restore()).toBe(false);
    expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
    expect(hook.error).toBe(PURCHASE_MESSAGES.unavailable);
  });
});
