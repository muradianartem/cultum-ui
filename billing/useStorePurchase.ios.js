// Buying Plus through StoreKit 2, then telling the backend about it.
//
// iOS only: Metro picks this file over billing/useStorePurchase.js on iOS, so
// Android and web never load expo-iap at all.
//
// The order is the whole point:
//
//   requestPurchase → StoreKit sheet → onPurchaseSuccess(purchase)
//     → POST /billing/apple/verify (the JWS) → apply the entitlement it returns
//     → finishTransaction
//
// Finishing only after the backend has the transaction is what makes a failed
// verify recoverable. StoreKit re-delivers an unfinished transaction the next
// time the store connects, it arrives through the same callback, and the
// endpoint is idempotent. Finishing first would leave a charged user on Free
// with nothing left to retry.
//
// Three callers now share that delivery step — a fresh purchase, a replay, and
// `restore()` — so it lives in `deliver()` and each caller only decides what to
// say about the result.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorCode, getAvailablePurchases, useIAP } from 'expo-iap';
import { verifyApplePurchase } from '../api/billing';
import { useEntitlement } from './EntitlementProvider';

export const PURCHASE_MESSAGES = {
  unavailable: "The App Store isn't available right now. Try again in a moment.",
  pending: 'Your purchase is waiting for approval.',
  failed: "The App Store couldn't complete the purchase. Try again.",
  verifyOffline:
    "Your purchase went through, but we couldn't confirm it while you're offline. It will be confirmed automatically.",
  verifyFailed: "Your purchase went through, but we couldn't confirm it yet. It will be retried automatically.",
  // Restore is the one flow where "nothing happened" is a legitimate outcome
  // and has to be said out loud: the button gives no other feedback, and the
  // usual reason is a different Apple ID rather than a fault.
  nothingToRestore: "We couldn't find an active subscription on this Apple ID.",
  restoreFailed: "We couldn't reach the App Store to restore your purchase. Try again.",
  // The backend's 409: this subscription is live on another Cultum account,
  // usually a household sharing one Apple ID. Never says "we'll retry" — the
  // answer will not change on its own, and the user has to pick an account.
  alreadyLinked: 'This subscription is already active on another Cultum account.',
};

// The backend's "that purchase belongs to somebody else" answer.
const CONFLICT = 409;

// ApiError codes that say "we never reached the server", as against the
// server answering and refusing.
const UNREACHABLE = new Set(['offline', 'network', 'timeout']);

/**
 * @param {Array<{ appleProductId: string|null }>} products  the paywall's products
 * @returns {{ supported: true, available: boolean, busy: boolean, restoring: boolean,
 *             error: string|null, prices: Record<string, string>,
 *             purchase: (product) => Promise<boolean>, restore: () => Promise<boolean> }}
 *   `purchase` resolves true once the backend has confirmed the purchase, and
 *   false on a cancel or any failure (which also sets `error`, except a cancel).
 *   `restore` resolves true only if a restored purchase actually granted Plus.
 *   `prices` maps an Apple product id to StoreKit's localized `displayPrice`.
 */
export default function useStorePurchase(products) {
  const { apply } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);

  // `{ sku, resolve }` for the tap currently waiting on StoreKit, if any.
  const pending = useRef(null);
  // Transactions being verified. StoreKit can hand the same one over twice
  // (the purchase, then a replay on reconnect) before either has finished.
  const inFlight = useRef(new Set());
  // Mirrors `restoring` for the guards. A second tap arrives before React has
  // re-rendered with the new state, so the state alone would let it through —
  // same reason the purchase path gates on `pending.current`.
  const restoringRef = useRef(false);
  const mounted = useRef(true);
  // useIAP's callbacks are built before useIAP returns, and they need its
  // finishTransaction — so everything they touch is read through refs.
  const iapRef = useRef(null);

  const settle = (ok, message = null) => {
    if (mounted.current) {
      setBusy(false);
      setError(message);
    }
    const waiting = pending.current;
    pending.current = null;
    waiting?.resolve(ok);
  };

  /**
   * Verify one transaction with the backend, apply what it answers, and only
   * then let StoreKit forget it.
   *
   * @returns {Promise<{ status: 'ok'|'busy'|'failed', dto?: object,
   *                     unreachable?: boolean, httpStatus?: number }>}
   *   `busy` means another caller is already delivering this same transaction,
   *   which is not a failure — the entitlement still lands, just not from here.
   */
  const deliver = async (purchase) => {
    const key = purchase?.transactionId ?? purchase?.id;
    if (!key || inFlight.current.has(key)) return { status: 'busy' };
    inFlight.current.add(key);
    try {
      let dto;
      try {
        dto = await verifyApplePurchase({
          // On iOS expo-iap's unified `purchaseToken` is the StoreKit 2 JWS.
          // With no JWS the id alone is still accepted by the backend.
          signedTransaction: purchase.purchaseToken,
          transactionId: purchase.transactionId ?? purchase.id,
        });
      } catch (e) {
        if (__DEV__) console.log('[billing] apple verify failed, transaction left unfinished:', e?.message ?? e);
        return { status: 'failed', unreachable: UNREACHABLE.has(e?.code), httpStatus: e?.status };
      }

      apply(dto);

      try {
        await iapRef.current?.finishTransaction({ purchase, isConsumable: false });
      } catch (e) {
        // The backend already has it and the entitlement is applied; an
        // unfinished transaction only replays and re-verifies, idempotently.
        if (__DEV__) console.log('[billing] finishTransaction failed:', e?.message ?? e);
      }
      return { status: 'ok', dto };
    } finally {
      inFlight.current.delete(key);
    }
  };

  // Both a fresh purchase and a replayed unfinished one land here. A replay
  // with no tap waiting is verified all the same, just silently.
  const onPurchaseSuccess = async (purchase) => {
    const forTap = pending.current != null && pending.current.sku === purchase?.productId;
    const result = await deliver(purchase);
    // Nothing to report: either nobody is waiting, or the transaction is
    // already being delivered by the call that got there first.
    if (!forTap || result.status === 'busy') return;
    if (result.status === 'ok') return settle(true);
    // A conflict is the one verify failure that will never come good on a
    // retry, so it must not be dressed up as one that will.
    if (result.httpStatus === CONFLICT) return settle(false, PURCHASE_MESSAGES.alreadyLinked);
    settle(false, result.unreachable ? PURCHASE_MESSAGES.verifyOffline : PURCHASE_MESSAGES.verifyFailed);
  };

  const onPurchaseError = (e) => {
    // Nobody is waiting: a stray error from a connection-level retry.
    if (!pending.current) return;
    if (e?.code === ErrorCode.UserCancelled) return settle(false);
    if (e?.code === ErrorCode.Pending || e?.code === ErrorCode.DeferredPayment) {
      return settle(false, PURCHASE_MESSAGES.pending);
    }
    if (__DEV__) console.log('[billing] purchase failed:', e?.code, e?.message);
    settle(false, PURCHASE_MESSAGES.failed);
  };

  const iap = useIAP({ onPurchaseSuccess, onPurchaseError });
  iapRef.current = iap;
  const { connected } = iap;

  // What StoreKit actually resolved. "SKU not found" at purchase time almost
  // always means this came back empty: the products are not sellable for this
  // bundle id / environment yet (App Store Connect state, Paid Apps agreement,
  // or a Simulator with no sandbox account or .storekit file).
  const resolved = (iap.subscriptions ?? []).map((s) => s.id).join(',');
  useEffect(() => {
    if (__DEV__ && connected) console.log('[billing] StoreKit resolved subscriptions:', resolved || '(none)');
  }, [connected, resolved]);

  // The real, localized, tax-inclusive price for this user's storefront, which
  // is the only price the paywall is allowed to show. `fallback_price` from the
  // API is right in a USD storefront and nowhere else, so it is only the
  // placeholder for the instant before StoreKit answers.
  //
  // Keyed by product id rather than by our own `key` because that is the one
  // identifier both sides share. Empty until `fetchProducts` resolves.
  const prices = useMemo(() => {
    const byId = {};
    for (const s of iap.subscriptions ?? []) {
      if (s?.id && s?.displayPrice) byId[s.id] = s.displayPrice;
    }
    return byId;
    // `resolved` changes whenever the subscription set does, and reading the
    // array itself here would rebuild the map on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  // StoreKit has to have resolved a product before it can sell it.
  const skuKey = products
    .map((p) => p.appleProductId)
    .filter(Boolean)
    .join(',');
  useEffect(() => {
    if (!connected || !skuKey) return;
    (async () => {
      try {
        await iapRef.current.fetchProducts({ skus: skuKey.split(','), type: 'subs' });
      } catch (e) {
        if (__DEV__) console.log('[billing] fetchProducts failed:', e?.message ?? e);
      }
    })();
  }, [connected, skuKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leave no caller awaiting a sheet that belongs to a gone screen.
      settle(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purchase = async (product) => {
    if (pending.current || restoringRef.current) return false;
    const sku = product?.appleProductId;
    if (!iapRef.current?.connected || !sku) {
      setError(PURCHASE_MESSAGES.unavailable);
      return false;
    }
    setBusy(true);
    setError(null);
    const result = new Promise((resolve) => {
      pending.current = { sku, resolve };
    });
    try {
      await iapRef.current.requestPurchase({ request: { apple: { sku } }, type: 'subs' });
    } catch (e) {
      // Some failures reject here as well as (or instead of) emitting an
      // error event; onPurchaseError ignores whichever arrives second.
      onPurchaseError(e);
    }
    return result;
  };

  /**
   * Re-attach a subscription this Apple ID already owns.
   *
   * Apple requires this: a reinstall, a new device or a second account leaves
   * StoreKit with nothing to replay, because a *finished* transaction is never
   * re-delivered. `getAvailablePurchases` asks for the current entitlements
   * instead of the event stream — active items only, which is its default.
   *
   * Every one of them goes through the same verify-then-finish path as a fresh
   * purchase, so a restore is just a purchase whose sheet was shown months ago.
   * Success is judged by what the *backend* said, not by finding a receipt: an
   * expired subscription restores perfectly well and grants nothing, and
   * closing the paywall on it would strand the user back on Free.
   */
  const restore = async () => {
    if (pending.current || restoringRef.current) return false;
    if (!iapRef.current?.connected) {
      setError(PURCHASE_MESSAGES.unavailable);
      return false;
    }
    restoringRef.current = true;
    setRestoring(true);
    setError(null);
    try {
      const owned = await getAvailablePurchases();
      let granted = false;
      // A transaction another caller is already delivering (a StoreKit replay
      // racing this tap). It may well be about to grant Plus, so it is not
      // evidence of nothing to restore — and saying so would be a lie the
      // entitlement contradicts a second later.
      let undecided = false;
      // A receipt we found and the backend refused as somebody else's. Worth
      // saying instead of "nothing found", because the user is holding the
      // subscription and needs to know which account has it.
      let conflict = false;
      for (const purchase of owned ?? []) {
        const result = await deliver(purchase);
        if (result.status === 'busy') undecided = true;
        if (result.httpStatus === CONFLICT) conflict = true;
        if (result.status === 'ok' && result.dto?.is_plus === true) granted = true;
      }
      if (!mounted.current) return granted;
      if (granted) return granted;
      if (conflict) setError(PURCHASE_MESSAGES.alreadyLinked);
      else if (!undecided) setError(PURCHASE_MESSAGES.nothingToRestore);
      return granted;
    } catch (e) {
      if (__DEV__) console.log('[billing] restore failed:', e?.message ?? e);
      if (mounted.current) setError(PURCHASE_MESSAGES.restoreFailed);
      return false;
    } finally {
      restoringRef.current = false;
      if (mounted.current) setRestoring(false);
    }
  };

  return { supported: true, available: connected, busy, restoring, error, prices, purchase, restore };
}
