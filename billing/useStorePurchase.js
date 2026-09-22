// The store purchase hook, for every platform without a store flow.
//
// Metro resolves billing/useStorePurchase.ios.js on iOS; this file is what
// Android and web get. Neither ever loads expo-iap, so purchase is iOS-only by
// construction rather than by a Platform.OS check someone can forget. The Play
// flow (POST /billing/google/verify) is not wired yet.

const NOT_SUPPORTED = {
  supported: false,
  available: false,
  busy: false,
  error: null,
  purchase: async () => false,
  // No store to ask, so the paywall keeps the backend's fallback price.
  termsFor: () => null,
};

export default function useStorePurchase() {
  return NOT_SUPPORTED;
}
