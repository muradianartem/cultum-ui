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

import { useEffect, useRef, useState } from 'react';
import { ErrorCode, useIAP } from 'expo-iap';
import { verifyApplePurchase } from '../api/billing';
import { useEntitlement } from './EntitlementProvider';

export const PURCHASE_MESSAGES = {
  unavailable: "The App Store isn't available right now. Try again in a moment.",
  pending: 'Your purchase is waiting for approval.',
  failed: "The App Store couldn't complete the purchase. Try again.",
  verifyOffline:
    "Your purchase went through, but we couldn't confirm it while you're offline. It will be confirmed automatically.",
  verifyFailed: "Your purchase went through, but we couldn't confirm it yet. It will be retried automatically.",
};

// ApiError codes that say "we never reached the server", as against the
// server answering and refusing.
const UNREACHABLE = new Set(['offline', 'network', 'timeout']);

/**
 * @param {Array<{ appleProductId: string|null }>} products  the paywall's products
 * @returns {{ supported: true, available: boolean, busy: boolean, error: string|null,
 *             purchase: (product) => Promise<boolean> }}
 *   `purchase` resolves true once the backend has confirmed the purchase, and
 *   false on a cancel or any failure (which also sets `error`, except a cancel).
 */
export default function useStorePurchase(products) {
  const { apply } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // `{ sku, resolve }` for the tap currently waiting on StoreKit, if any.
  const pending = useRef(null);
  // Transactions being verified. StoreKit can hand the same one over twice
  // (the purchase, then a replay on reconnect) before either has finished.
  const inFlight = useRef(new Set());
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

  // Both a fresh purchase and a replayed unfinished one land here. A replay
  // with no tap waiting is verified all the same, just silently.
  const onPurchaseSuccess = async (purchase) => {
    const key = purchase?.transactionId ?? purchase?.id;
    if (!key || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    const forTap = pending.current != null && pending.current.sku === purchase.productId;
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
        if (forTap) {
          settle(false, UNREACHABLE.has(e?.code) ? PURCHASE_MESSAGES.verifyOffline : PURCHASE_MESSAGES.verifyFailed);
        }
        return;
      }

      apply(dto);

      try {
        await iapRef.current?.finishTransaction({ purchase, isConsumable: false });
      } catch (e) {
        // The backend already has it and the entitlement is applied; an
        // unfinished transaction only replays and re-verifies, idempotently.
        if (__DEV__) console.log('[billing] finishTransaction failed:', e?.message ?? e);
      }
      if (forTap) settle(true);
    } finally {
      inFlight.current.delete(key);
    }
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
    if (pending.current) return false;
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

  return { supported: true, available: connected, busy, error, purchase };
}
