// What differs between the App Store and Google Play, and nothing else.
//
// billing/useStorePurchase.native.js runs one flow on both platforms —
// request → store sheet → verify with the backend → apply → finish — and asks
// the adapter here for the handful of things that are genuinely per-store:
//
//   - which of our product ids the store sells under (`skuOf`)
//   - how to ask for a subscription (`purchaseRequest`): StoreKit takes a sku,
//     Play also needs the offer token of the base plan or trial being bought
//   - what to send the backend (`verify`): Apple's signed JWS, Play's opaque
//     purchase token
//   - the localized price to show (`priceOf`)
//   - the words: "the App Store" / "Apple ID" vs "Google Play" / "Google account"
//
// Nothing here imports expo-iap, so it is safe to load on web.

import { Platform } from 'react-native';
import { verifyApplePurchase, verifyGooglePurchase } from '../api/billing';

const messages = ({ store, account }) => ({
  unavailable: `${store} isn't available right now. Try again in a moment.`,
  pending: 'Your purchase is waiting for approval.',
  failed: `${store} couldn't complete the purchase. Try again.`,
  verifyOffline:
    "Your purchase went through, but we couldn't confirm it while you're offline. It will be confirmed automatically.",
  verifyFailed: "Your purchase went through, but we couldn't confirm it yet. It will be retried automatically.",
  // Restore is the one flow where "nothing happened" is a legitimate outcome
  // and has to be said out loud: the button gives no other feedback, and the
  // usual reason is a different store account rather than a fault.
  nothingToRestore: `We couldn't find an active subscription on this ${account}.`,
  restoreFailed: `We couldn't reach ${store} to restore your purchase. Try again.`,
  // The backend's 409: this subscription is live on another Cultum account,
  // usually a household sharing one store account. Never says "we'll retry" —
  // the answer will not change on its own, and the user has to pick an account.
  alreadyLinked: 'This subscription is already active on another Cultum account.',
});

const APPLE = {
  id: 'apple',
  messages: messages({ store: 'The App Store', account: 'Apple ID' }),
  skuOf: (product) => product?.appleProductId ?? null,
  // StoreKit resolves offers (the free trial) itself from the product.
  purchaseRequest: (sku) => ({ apple: { sku } }),
  // One transaction per purchase; the id is what StoreKit replays it under.
  keyOf: (purchase) => purchase?.transactionId ?? purchase?.id ?? null,
  verify: (purchase) =>
    verifyApplePurchase({
      // On iOS expo-iap's unified `purchaseToken` is the StoreKit 2 JWS.
      // With no JWS the id alone is still accepted by the backend.
      signedTransaction: purchase.purchaseToken,
      transactionId: purchase.transactionId ?? purchase.id,
    }),
  priceOf: (subscription) => subscription?.displayPrice ?? null,
};

const phasesOf = (offer) => offer?.pricingPhasesAndroid?.pricingPhaseList ?? [];
const isFree = (phase) => phase?.priceAmountMicros === '0' || Number(phase?.priceAmountMicros) === 0;

/**
 * The Play offer to buy: the free trial when the user is eligible for one,
 * else the plain base plan.
 *
 * Play only returns the offers this user is eligible for, so a trial offer
 * being present *is* the eligibility check — someone who already had a trial
 * simply does not get it back, and falls through to the base plan.
 */
export function pickGoogleOffer(subscription) {
  const offers = (subscription?.subscriptionOffers ?? []).filter((o) => o?.offerTokenAndroid);
  return (
    offers.find((o) => phasesOf(o).some(isFree)) ??
    // A base plan's offer is a single recurring phase.
    offers.find((o) => phasesOf(o).length === 1) ??
    offers[0] ??
    null
  );
}

const GOOGLE = {
  id: 'google',
  messages: messages({ store: 'Google Play', account: 'Google account' }),
  skuOf: (product) => product?.googleProductId ?? null,
  // Play will not sell a subscription without an offer token: it is what says
  // *which* base plan and offer of the product is being bought.
  purchaseRequest: (sku, subscription) => {
    const offer = pickGoogleOffer(subscription);
    return {
      google: {
        skus: [sku],
        ...(offer ? { subscriptionOffers: [{ sku, offerToken: offer.offerTokenAndroid }] } : {}),
      },
    };
  },
  // Play's order id can be missing on a pending or trial purchase; the token
  // is always there and is what the backend keys on.
  keyOf: (purchase) => purchase?.purchaseToken ?? null,
  verify: (purchase) =>
    verifyGooglePurchase({ purchaseToken: purchase.purchaseToken, productId: purchase.productId }),
  /**
   * The recurring price, not the product's `displayPrice`: with a trial offer
   * first in line, that can be the trial's "Free", which would be a lie on a
   * price bar that says "then … per year".
   */
  priceOf: (subscription) => {
    const offer = pickGoogleOffer(subscription);
    const phases = phasesOf(offer);
    // recurrenceMode 1 = INFINITE_RECURRING, the phase that bills forever.
    const recurring = phases.find((p) => p?.recurrenceMode === 1) ?? phases[phases.length - 1];
    return recurring?.formattedPrice ?? subscription?.displayPrice ?? null;
  },
};

/** The adapter for a platform. Android is Play; everything else is Apple. */
export function storeFor(os = Platform.OS) {
  return os === 'android' ? GOOGLE : APPLE;
}

/**
 * The store product id a paywall product sells under on this platform — the
 * key of the purchase hook's `prices`.
 */
export function storeSku(product, os = Platform.OS) {
  return storeFor(os).skuOf(product);
}
