import { reportPurchaseFailure, verifyApplePurchase, verifyGooglePurchase } from '../billing';
import { apiFetch } from '../client';

// Its own file: billing.test.js exercises the pure mappers against the real
// module, and this one needs the transport mocked.
jest.mock('../client', () => ({ apiFetch: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const init = () => apiFetch.mock.calls[0][1];

test('verifyApplePurchase posts the StoreKit transaction as AppleVerifyRequest', async () => {
  apiFetch.mockResolvedValueOnce({ plan: 'plus', is_plus: true });
  const out = await verifyApplePurchase({ signedTransaction: 'jws', transactionId: '2000000123' });

  expect(apiFetch.mock.calls[0][0]).toBe('/billing/apple/verify');
  expect(init().method).toBe('POST');
  expect(JSON.parse(init().body)).toEqual({ signed_transaction: 'jws', transaction_id: '2000000123' });
  // Longer than the client's 30s default: the dev backend's cold start.
  expect(init().timeoutMs).toBeGreaterThan(30000);
  expect(out).toEqual({ plan: 'plus', is_plus: true });
});

test('an id alone is sent with a null JWS, as the restore path expects', async () => {
  apiFetch.mockResolvedValueOnce({});
  await verifyApplePurchase({ transactionId: '2000000123' });
  expect(JSON.parse(init().body)).toEqual({ signed_transaction: null, transaction_id: '2000000123' });
});

test('verifyGooglePurchase posts the Play purchase token as GoogleVerifyRequest', async () => {
  apiFetch.mockResolvedValueOnce({ plan: 'plus', is_plus: true });
  await verifyGooglePurchase({ purchaseToken: 'play-token', productId: 'cultum_plus_yearly' });

  expect(apiFetch.mock.calls[0][0]).toBe('/billing/google/verify');
  expect(init().method).toBe('POST');
  expect(JSON.parse(init().body)).toEqual({ purchase_token: 'play-token', product_id: 'cultum_plus_yearly' });
  expect(init().timeoutMs).toBeGreaterThan(30000);
});

test('reportPurchaseFailure posts the failure in the backend shape', async () => {
  apiFetch.mockResolvedValueOnce(null);
  await reportPurchaseFailure({
    store: 'apple',
    stage: 'error',
    productId: 'com.cultum.plus.yearly',
    code: 'user-cancelled',
    message: 'cancelled',
    interrupted: true,
    appVersion: '1.1.7',
    build: '27',
    osVersion: 18.1,
  });

  expect(apiFetch.mock.calls[0][0]).toBe('/billing/client-events/purchase-failed');
  expect(JSON.parse(init().body)).toEqual({
    store: 'apple',
    stage: 'error',
    product_id: 'com.cultum.plus.yearly',
    code: 'user-cancelled',
    message: 'cancelled',
    interrupted: true,
    shown: null,
    app_version: '1.1.7',
    build: '27',
    os_version: '18.1',
  });
});

test('a report that cannot be sent never throws', async () => {
  apiFetch.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'offline' }));
  await expect(reportPurchaseFailure({ store: 'apple', stage: 'error' })).resolves.toBeUndefined();
});
