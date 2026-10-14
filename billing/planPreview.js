// `EXPO_PUBLIC_PLAN_PREVIEW=trial-ending|trial-ended|plus-ended` in a
// development build starts the app on a made-up entitlement, so the Figma
// "Trial ends" flow (998:726) can be walked in the Simulator.
//
// It has to be faked: the dev auth bypass never fetches the entitlement, and a
// real lapse takes a StoreKit sandbox trial running out. Nothing here reaches
// a release build (`__DEV__`), and while a preview is on the provider does not
// poll — the server's real answer would replace the fixture at once.

const DAY_MS = 24 * 60 * 60 * 1000;

const NAMES = ['trial-ending', 'trial-ended', 'plus-ended'];

export function planPreview() {
  if (!__DEV__) return null;
  const value = process.env.EXPO_PUBLIC_PLAN_PREVIEW;
  return NAMES.includes(value) ? value : null;
}

const FREE_LIMITS = {
  scans_per_day: 3,
  plants: 1,
  guides_per_day: null,
  custom_reminders: false,
  adaptive_reminders: true,
  bulk_actions: true,
};
const PLUS_LIMITS = { ...FREE_LIMITS, scans_per_day: 30, plants: null, custom_reminders: true };

/** The EntitlementOut a preview starts from, or null when none is set. */
export function previewEntitlementDto(name = planPreview(), now = new Date()) {
  if (!name) return null;
  const at = (days) => new Date(now.getTime() + days * DAY_MS).toISOString();
  // A fresh id per launch, so the "seen it" record (lib/planLapseAck.js) never
  // stops the preview from showing.
  const subscription = {
    id: `preview-${now.getTime()}`,
    store: 'apple',
    product_id: 'com.cultum.plus.yearly',
    auto_renew: false,
    environment: 'sandbox',
    canceled_at: null,
  };
  if (name === 'trial-ending') {
    return {
      plan: 'plus',
      is_plus: true,
      limits: PLUS_LIMITS,
      usage: null,
      subscription: { ...subscription, status: 'trialing', expires_at: at(2), trial_ends_at: at(2) },
    };
  }
  return {
    plan: 'free',
    is_plus: false,
    limits: FREE_LIMITS,
    usage: null,
    subscription: {
      ...subscription,
      status: 'expired',
      expires_at: at(-1),
      trial_ends_at: name === 'trial-ended' ? at(-1) : null,
    },
    // Not a real plant id: the sheet falls back to the first plant.
    free_plant_id: 'preview',
    free_plant_chosen: false,
  };
}
