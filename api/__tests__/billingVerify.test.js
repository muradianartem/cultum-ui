import { verifyApplePurchase } from '../billing';
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
