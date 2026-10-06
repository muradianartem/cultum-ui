import { pickGoogleOffer, storeFor, storeSku } from '../stores';

const PRODUCT = { key: 'yearly', appleProductId: 'com.cultum.plus.yearly', googleProductId: 'cultum_plus_yearly' };
const phase = (priceAmountMicros, formattedPrice, recurrenceMode) => ({
  priceAmountMicros,
  formattedPrice,
  recurrenceMode,
});
const offer = (offerTokenAndroid, phases) => ({
  offerTokenAndroid,
  pricingPhasesAndroid: { pricingPhaseList: phases },
});

test('each platform sells under its own product id', () => {
  expect(storeSku(PRODUCT, 'ios')).toBe('com.cultum.plus.yearly');
  expect(storeSku(PRODUCT, 'android')).toBe('cultum_plus_yearly');
});

test('the trial offer wins when Play offers one', () => {
  const sub = {
    subscriptionOffers: [
      offer('base', [phase('39990000', '$39.99', 1)]),
      offer('trial', [phase('0', 'Free', 2), phase('39990000', '$39.99', 1)]),
    ],
  };
  expect(pickGoogleOffer(sub).offerTokenAndroid).toBe('trial');
});

test('with no trial on offer (already used) the base plan is bought', () => {
  const sub = { subscriptionOffers: [offer('base', [phase('39990000', '$39.99', 1)])] };
  expect(pickGoogleOffer(sub).offerTokenAndroid).toBe('base');
  expect(storeFor('android').purchaseRequest('cultum_plus_yearly', sub)).toEqual({
    google: { skus: ['cultum_plus_yearly'], subscriptionOffers: [{ sku: 'cultum_plus_yearly', offerToken: 'base' }] },
  });
});

test('an unresolved product has no offer', () => {
  expect(pickGoogleOffer(undefined)).toBeNull();
});

test('Apple prices are StoreKit displayPrice', () => {
  expect(storeFor('ios').priceOf({ displayPrice: '£34.99' })).toBe('£34.99');
});
