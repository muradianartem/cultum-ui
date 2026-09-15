import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// StoreKit is faked at the hook boundary: these tests hold the callbacks the
// hook hands useIAP and fire them the way the native module would.
const mockCallbacks = { current: null };
const mockIap = {
  connected: true,
  fetchProducts: jest.fn(async () => {}),
  requestPurchase: jest.fn(async () => {}),
  finishTransaction: jest.fn(async () => {}),
};
jest.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled', Pending: 'pending', DeferredPayment: 'deferred-payment' },
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
