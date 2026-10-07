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

test('Apple terms are StoreKit\x27s, with the trial gated on eligibility', () => {
  const sub = {
    displayPrice: '£34.99',
    subscriptionGroupIdIOS: 'g',
    subscriptionPeriodNumberIOS: '1',
    subscriptionPeriodUnitIOS: 'year',
    introductoryPricePaymentModeIOS: 'free-trial',
    introductoryPriceNumberOfPeriodsIOS: '1',
    introductoryPriceSubscriptionPeriodIOS: 'week',
  };
  expect(storeFor('ios').termsOf(sub, { g: true })).toEqual({
    displayPrice: '£34.99',
    periodLabel: 'year',
    trial: { days: 7, label: '1 week free' },
  });
  expect(storeFor('ios').termsOf(sub, {}).trial).toBeNull();
});

test('Play terms read the period off the recurring phase', () => {
  const sub = {
    subscriptionOffers: [
      {
        offerTokenAndroid: 't',
        pricingPhasesAndroid: {
          pricingPhaseList: [{ formattedPrice: '€5.99', priceAmountMicros: '5990000', recurrenceMode: 1, billingPeriod: 'P3M' }],
        },
      },
    ],
  };
  expect(storeFor('android').termsOf(sub)).toEqual({ displayPrice: '€5.99', periodLabel: '3 months', trial: null });
});
