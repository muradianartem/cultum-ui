// Billing — the paywall's content and the store receipt exchange.
//
// GET /billing/plans is PUBLIC. The backend describes it as "everything the
// paywall screen renders", shown during onboarding before there is an account,
// so it needs no bearer token — which is what lets billing/paywallContent.js
// prefetch it from the Login screen, before a session exists.
//
// POST /billing/apple/verify takes what StoreKit 2 hands back after a purchase
// (billing/useStorePurchase.ios.js) and answers with the caller's new
// entitlement. POST /billing/google/verify is the Play equivalent: it takes the
// purchase token, and the backend both reads and acknowledges the purchase.

import { apiFetch } from './client';

// Above client.js's 30s default on purpose: the dev backend scales to zero and
// the first request after an idle period pays a ~30s cold start (the same fact
// api/health.js#warmUp exists for), so the default deadline makes this a coin
// flip. Nothing is waiting on it — the screen renders bundled defaults while it
// runs — so a long deadline costs nobody anything.
const PAYWALL_TIMEOUT_MS = 45000;

/**
 * GET /billing/plans → PaywallOut. Public (no auth).
 *
 * Raw DTO, snake_case. Run it through `mapPaywall` before it reaches a screen.
 */
export async function getPaywall({ timeoutMs = PAYWALL_TIMEOUT_MS } = {}) {
  return apiFetch('/billing/plans', { timeoutMs });
}

/**
 * GET /users/me/subscription → EntitlementOut. Authenticated.
 *
 * `{ plan, is_plus, limits, usage, subscription, free_plant_id, free_plant_chosen }`
 * — the backend calls it "the
 * caller's plan, limits and usage, polled by the app on launch". Only `is_plus`
 * is read today (the upgrade card, the subscription guard); `limits` is what a
 * plant/scan ceiling will read when those are enforced client-side.
 *
 * Raw DTO, snake_case. Run it through `mapEntitlement`.
 */
export async function getEntitlement() {
  return apiFetch('/users/me/subscription');
}

/**
 * POST /billing/apple/verify → EntitlementOut. Authenticated.
 *
 * `signedTransaction` is StoreKit 2's `Transaction.jwsRepresentation`;
 * `transactionId` alone is accepted too (a restore on a device with the id but
 * no JWS). The backend is idempotent here — it is also the restore path — so a
 * transaction left unfinished after a failed call is safe to send again.
 *
 * Same long deadline as the paywall: this is the request a paying user is
 * staring at a spinner for, and a cold start must not turn it into an error.
 */
export async function verifyApplePurchase({ signedTransaction, transactionId } = {}) {
  return apiFetch('/billing/apple/verify', {
    method: 'POST',
    body: JSON.stringify({
      signed_transaction: signedTransaction ?? null,
      transaction_id: transactionId ?? null,
    }),
    timeoutMs: PAYWALL_TIMEOUT_MS,
  });
}

/**
 * POST /billing/google/verify → EntitlementOut. Authenticated.
 *
 * `purchaseToken` is Play Billing's opaque token; the backend spends it on the
 * Play Developer API, which is the verification, and acknowledges the purchase
 * there (Play refunds anything unacknowledged after three days). `productId` is
 * informational only. Idempotent like the Apple call, so a retry is safe.
 */
export async function verifyGooglePurchase({ purchaseToken, productId } = {}) {
  return apiFetch('/billing/google/verify', {
    method: 'POST',
    body: JSON.stringify({
      purchase_token: purchaseToken,
      product_id: productId ?? null,
    }),
    timeoutMs: PAYWALL_TIMEOUT_MS,
  });
}

/**
 * POST /billing/client-events/purchase-failed → 204. Authenticated.
 *
 * A purchase that dies inside StoreKit or Play Billing never reaches verify, so
 * this is the server's only record that someone tried. Fire and forget: it
 * never throws, because a failed report must not become a second failure on a
 * screen that already has one.
 */
export async function reportPurchaseFailure({
  store,
  stage,
  productId,
  code,
  message,
  interrupted = false,
  shown = null,
  appVersion,
  build,
  osVersion,
} = {}) {
  try {
    await apiFetch('/billing/client-events/purchase-failed', {
      method: 'POST',
      body: JSON.stringify({
        store,
        stage,
        product_id: productId ?? null,
        code: code == null ? null : String(code).slice(0, 100),
        message: message == null ? null : String(message).slice(0, 500),
        interrupted,
        shown,
        app_version: appVersion ?? null,
        build: build ?? null,
        os_version: osVersion == null ? null : String(osVersion),
      }),
    });
  } catch (e) {
    if (__DEV__) console.log('[billing] failure report not sent:', e?.message ?? e);
  }
}

/**
 * EntitlementOut → the camelCase shape the app uses.
 *
 * Unlike `mapPaywall` this never returns null: there is always an answer to
 * "is this user Plus", and the safe one is no. A payload we cannot read means
 * `free`, which shows an upgrade card to someone who may not need it — the
 * mistake that costs nothing, as against hiding Plus from someone paying for it.
 */
export function mapEntitlement(dto) {
  const plan = dto?.plan === 'plus' ? 'plus' : 'free';
  return {
    plan,
    isPlus: dto?.is_plus === true,
    limits: dto?.limits ?? null,
    usage: dto?.usage ?? null,
    subscription: dto?.subscription ?? null,
    // Over the free plant limit after a lapse, the one plant that keeps its
    // reminders (the user's pick, else the earliest added) — null when nothing
    // is paused. `freePlantChosen` is whether the pick has been made; it can
    // only be made once.
    freePlantId: typeof dto?.free_plant_id === 'string' ? dto.free_plant_id : null,
    freePlantChosen: dto?.free_plant_chosen === true,
  };
}

const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
const int = (v) => (Number.isFinite(v) ? Math.trunc(v) : 0);
const arr = (v) => (Array.isArray(v) ? v : []);

function mapStep(dto) {
  const label = str(dto?.label);
  const title = str(dto?.title);
  if (!label || !title) return null;
  return { day: int(dto.day), label, title, body: str(dto.body) ?? '' };
}

function mapFeature(dto) {
  const key = str(dto?.key);
  const label = str(dto?.label);
  if (!key || !label) return null;
  // `free` / `plus` are the cell text; null means "blank" in the FREE column
  // and "a tick" in the PLUS one.
  return { key, label, free: str(dto.free), plus: str(dto.plus) };
}

function mapProduct(dto) {
  const key = str(dto?.key);
  const label = str(dto?.label);
  const period = str(dto?.period);
  const fallbackPrice = str(dto?.fallback_price);
  if (!key || !label || !period || !fallbackPrice) return null;
  return {
    key,
    label,
    period,
    // The *fallback* price: correct only in a USD storefront, and replaced by
    // the StoreKit/Play-resolved localized price once IAP lands.
    fallbackPrice,
    badge: str(dto.badge),
    appleProductId: str(dto.apple_product_id),
    googleProductId: str(dto.google_product_id),
    trialDays: int(dto.trial_days),
    isDefault: dto.default === true,
  };
}

/**
 * PaywallOut → the camelCase `PaywallContent` every consumer sees, or `null`
 * when the payload cannot be trusted.
 *
 * Validating rather than trusting, because the alternative is a crash on a
 * sales page: a content object with `products: []` blows up the price bar on
 * first render. Nothing is bundled to fall back to, so `null` means the paywall
 * simply is not shown — see billing/PaywallLauncher.js.
 *
 * A malformed timeline step or feature row is dropped rather than fatal (one
 * missing row is not worth discarding good copy), but a malformed *product* is:
 * products are what is being sold, and silently offering one of two plans is
 * worse than offering the bundled pair.
 */
export function mapPaywall(dto) {
  const title = str(dto?.title);
  if (!title) return null;

  const timeline = arr(dto.timeline).map(mapStep).filter(Boolean);
  const features = arr(dto.features).map(mapFeature).filter(Boolean);
  const rawProducts = arr(dto.products);
  const products = rawProducts.map(mapProduct).filter(Boolean);

  if (!timeline.length || !features.length || !products.length) return null;
  if (products.length !== rawProducts.length) return null;

  return {
    title,
    // The screen's headline is two lines and the API's title is one string.
    // Breaking after the comma reproduces the Figma frame exactly, and a title
    // with no comma degrades to a single line rather than breaking.
    titleLines: title.replace(/,\s+/, ',\n'),
    trialDays: int(dto.trial_days),
    timeline,
    features,
    products,
    defaultProductKey: (products.find((p) => p.isDefault) ?? products[0]).key,
    footnote: str(dto.footnote) ?? '',
  };
}
