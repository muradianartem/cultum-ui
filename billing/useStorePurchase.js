// The store purchase hook, for every platform without a store flow.
//
// Metro resolves billing/useStorePurchase.ios.js on iOS; this file is what
// Android and web get. Neither ever loads expo-iap, so purchase is iOS-only by
// construction rather than by a Platform.OS check someone can forget. The Play
// flow (POST /billing/google/verify) is not wired yet.
//
// Same shape as the iOS hook, so no caller needs a platform branch: `prices` is
// simply empty (every consumer falls back to the API's `fallback_price`), and
// `restore` is a no-op rather than a missing function. `supported: false` is
// what a screen keys off to hide store-only affordances altogether.

const NOT_SUPPORTED = {
  supported: false,
  available: false,
  busy: false,
  restoring: false,
  error: null,
  prices: {},
  purchase: async () => false,
  restore: async () => false,
};

export default function useStorePurchase() {
  return NOT_SUPPORTED;
}
