// Buying Plus through StoreKit 2 or Play Billing, then telling the backend.
//
// iOS and Android: Metro picks this file over billing/useStorePurchase.js on
// both native platforms, so web never loads expo-iap at all. What differs
// between the two stores lives in billing/stores.js; the flow here is shared.
//
// The order is the whole point:
//
//   requestPurchase → store sheet → onPurchaseSuccess(purchase)
//     → POST /billing/{apple,google}/verify → apply the entitlement it returns
//     → finishTransaction
//
// Finishing only after the backend has the transaction is what makes a failed
// verify recoverable. Both stores re-deliver an unfinished purchase the next
// time the store connects, it arrives through the same callback, and the
// endpoints are idempotent. Finishing first would leave a charged user on Free
// with nothing left to retry. (On Play "finish" is the acknowledgement, which
// the backend already made while verifying - so here it is only a fallback,
// and an "already acknowledged" failure is harmless.)
//
// Three callers now share that delivery step — a fresh purchase, a replay, and
// `restore()` — so it lives in `deliver()` and each caller only decides what to
// say about the result.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorCode, getAvailablePurchases, isEligibleForIntroOfferIOS, useIAP } from 'expo-iap';
import { useEntitlement } from './EntitlementProvider';
import { storeFor } from './stores';

// The backend's "that purchase belongs to somebody else" answer.
const CONFLICT = 409;

// ApiError codes that say "we never reached the server", as against the
// server answering and refusing.
const UNREACHABLE = new Set(['offline', 'network', 'timeout']);

// Play's "paid with cash at a shop, not yet settled". Not a subscription yet:
// verifying it would record an expired row, and acknowledging it is refused.
// Play delivers it again, as purchased, once the payment clears.
const isPending = (purchase) => purchase?.purchaseState === 'pending';

/**
 * @param {Array<{ appleProductId: string|null, googleProductId: string|null }>} products
 *   the paywall's products
 * @returns {{ supported: true, available: boolean, busy: boolean, restoring: boolean,
 *             error: string|null, purchase: (product) => Promise<boolean>,
 *             restore: () => Promise<boolean>,
 *             termsFor: (product) => ReturnType<typeof storeTerms> | null }}
 *   `purchase` resolves true once the backend has confirmed the purchase, and
 *   false on a cancel or any failure (which also sets `error`, except a cancel).
 *   `restore` resolves true only if a restored purchase actually granted Plus.
 *   `termsFor` is the store's price and trial for the product (shaped like
 *   billing/storeTerms.js), or null until the store has resolved its SKU — and
 *   an unresolved SKU cannot be bought.
 */
export default function useStorePurchase(products) {
  const store = storeFor();
  const MESSAGES = store.messages;
  const { apply } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  // Intro-offer eligibility per App Store subscription group:
  // `{ [groupId]: boolean }`. A group missing here is unknown, which storeTerms
  // reads as "no trial". Play needs none of this: it only returns offers the
  // user is eligible for.
  const [eligibility, setEligibility] = useState({});

  // `{ sku, resolve }` for the tap currently waiting on the store, if any.
  const pending = useRef(null);
  // Transactions being verified. The store can hand the same one over twice
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
   * then let the store forget it.
   *
   * @returns {Promise<{ status: 'ok'|'busy'|'failed', dto?: object,
   *                     unreachable?: boolean, httpStatus?: number }>}
   *   `busy` means another caller is already delivering this same transaction,
   *   which is not a failure — the entitlement still lands, just not from here.
   */
  const deliver = async (purchase) => {
    const key = store.keyOf(purchase);
    if (!key || inFlight.current.has(key)) return { status: 'busy' };
    inFlight.current.add(key);
    try {
      let dto;
      try {
        dto = await store.verify(purchase);
      } catch (e) {
        if (__DEV__) console.log(`[billing] ${store.id} verify failed, transaction left unfinished:`, e?.message ?? e);
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
    if (isPending(purchase)) {
      if (forTap) settle(false, MESSAGES.pending);
      return;
    }
    const result = await deliver(purchase);
    // Nothing to report: either nobody is waiting, or the transaction is
    // already being delivered by the call that got there first.
    if (!forTap || result.status === 'busy') return;
    if (result.status === 'ok') return settle(true);
    // A conflict is the one verify failure that will never come good on a
    // retry, so it must not be dressed up as one that will.
    if (result.httpStatus === CONFLICT) return settle(false, MESSAGES.alreadyLinked);
    settle(false, result.unreachable ? MESSAGES.verifyOffline : MESSAGES.verifyFailed);
  };

  const onPurchaseError = (e) => {
    // Nobody is waiting: a stray error from a connection-level retry.
    if (!pending.current) return;
    if (e?.code === ErrorCode.UserCancelled) return settle(false);
    if (e?.code === ErrorCode.Pending || e?.code === ErrorCode.DeferredPayment) {
      return settle(false, MESSAGES.pending);
    }
    if (__DEV__) console.log('[billing] purchase failed:', e?.code, e?.message);
    settle(false, MESSAGES.failed);
  };

  const iap = useIAP({ onPurchaseSuccess, onPurchaseError });
  iapRef.current = iap;
  const { connected } = iap;

  // What the store actually resolved. "SKU not found" at purchase time almost
  // always means this came back empty: the products are not sellable for this
  // app / environment yet. On iOS: App Store Connect state, Paid Apps
  // agreement, or a Simulator with no sandbox account or .storekit file. On
  // Android: a build not installed from a Play testing track, a tester not on
  // the licence list, or a subscription with no active base plan.
  const resolved = (iap.subscriptions ?? []).map((s) => s.id).join(',');
  useEffect(() => {
    if (__DEV__ && connected) console.log(`[billing] ${store.id} resolved subscriptions:`, resolved || '(none)');
  }, [connected, resolved, store.id]);

  // The store has to have resolved a product before it can sell it.
  const skuKey = products
    .map((p) => store.skuOf(p))
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

  // A returning subscriber is not owed the free trial, so ask StoreKit per group
  // before promising one. A failed check is stored as ineligible.
  const subscriptions = iap.subscriptions;
  const groupKey =
    store.id === 'apple'
      ? [...new Set((subscriptions ?? []).map((s) => s.subscriptionGroupIdIOS).filter(Boolean))]
          .sort()
          .join(',')
      : '';
  useEffect(() => {
    if (!groupKey) return;
    for (const groupId of groupKey.split(',')) {
      if (groupId in eligibility) continue;
      (async () => {
        let eligible;
        try {
          eligible = (await isEligibleForIntroOfferIOS(groupId)) === true;
        } catch (e) {
          if (__DEV__) console.log('[billing] intro offer eligibility failed:', e?.message ?? e);
          eligible = false;
        }
        if (mounted.current) setEligibility((prev) => ({ ...prev, [groupId]: eligible }));
      })();
    }
    // Keyed on the groups alone: `eligibility` only grows, and re-running on it
    // would just skip every group it already holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  // The real, localized, tax-inclusive price for this user's storefront, which
  // is the only price the paywall is allowed to show. Keyed by store product id,
  // the one identifier both sides share. Empty until `fetchProducts` resolves.
  const termsBySku = useMemo(() => {
    const map = new Map();
    for (const sub of subscriptions ?? []) {
      if (!sub?.id) continue;
      map.set(sub.id, store.termsOf(sub, eligibility));
    }
    return map;
    // `store` is fixed per platform.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions, eligibility]);

  const termsFor = (product) => termsBySku.get(store.skuOf(product)) ?? null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leave no caller awaiting a sheet that belongs to a gone screen.
      settle(false);
    };
  }, []);

  const purchase = async (product) => {
    if (pending.current || restoringRef.current) return false;
    const sku = store.skuOf(product);
    // Unresolved means the store has not priced it, so there is nothing the
    // user could knowingly agree to — and Play could not sell it anyway: its
    // offer token, which says which base plan or trial is bought, lives on the
    // resolved product.
    const subscription = (iapRef.current?.subscriptions ?? []).find((s) => s?.id === sku);
    if (!iapRef.current?.connected || !sku || !termsFor(product)) {
      setError(MESSAGES.unavailable);
      return false;
    }
    setBusy(true);
    setError(null);
    const result = new Promise((resolve) => {
      pending.current = { sku, resolve };
    });
    try {
      await iapRef.current.requestPurchase({ request: store.purchaseRequest(sku, subscription), type: 'subs' });
    } catch (e) {
      // Some failures reject here as well as (or instead of) emitting an
      // error event; onPurchaseError ignores whichever arrives second.
      onPurchaseError(e);
    }
    return result;
  };

  /**
   * Re-attach a subscription this Apple ID / Google account already owns.
   *
   * Apple requires this: a reinstall, a new device or a second account leaves
   * the store with nothing to replay, because a *finished* transaction is never
   * re-delivered. On Play it is the same button for the same reasons.
   * `getAvailablePurchases` asks for the current entitlements
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
      setError(MESSAGES.unavailable);
      return false;
    }
    restoringRef.current = true;
    setRestoring(true);
    setError(null);
    try {
      const owned = await getAvailablePurchases();
      let granted = false;
      // A transaction another caller is already delivering (a store replay
      // racing this tap). It may well be about to grant Plus, so it is not
      // evidence of nothing to restore — and saying so would be a lie the
      // entitlement contradicts a second later.
      let undecided = false;
      // A receipt we found and the backend refused as somebody else's. Worth
      // saying instead of "nothing found", because the user is holding the
      // subscription and needs to know which account has it.
      let conflict = false;
      for (const purchase of owned ?? []) {
        // Not paid for yet, so nothing to restore; it arrives on its own later.
        if (isPending(purchase)) {
          undecided = true;
          continue;
        }
        const result = await deliver(purchase);
        if (result.status === 'busy') undecided = true;
        if (result.httpStatus === CONFLICT) conflict = true;
        if (result.status === 'ok' && result.dto?.is_plus === true) granted = true;
      }
      if (!mounted.current) return granted;
      if (granted) return granted;
      if (conflict) setError(MESSAGES.alreadyLinked);
      else if (!undecided) setError(MESSAGES.nothingToRestore);
      return granted;
    } catch (e) {
      if (__DEV__) console.log('[billing] restore failed:', e?.message ?? e);
      if (mounted.current) setError(MESSAGES.restoreFailed);
      return false;
    } finally {
      restoringRef.current = false;
      if (mounted.current) setRestoring(false);
    }
  };

  return { supported: true, available: connected, busy, restoring, error, purchase, restore, termsFor };
}
