// The store purchase hook, for every platform without a store flow.
//
// Metro resolves billing/useStorePurchase.native.js on iOS and Android; this
// file is what web gets. It never loads expo-iap, so purchase is native-only by
// construction rather than by a Platform.OS check someone can forget.
//
// Same shape as the native hook, so no caller needs a platform branch:
// `termsFor` answers null (every consumer falls back to the API's
// `fallback_price`), and `restore` is a no-op rather than a missing function.
// `supported: false` is what a screen keys off to hide store-only affordances
// altogether.

const NOT_SUPPORTED = {
  supported: false,
  available: false,
  busy: false,
  restoring: false,
  error: null,
  purchase: async () => false,
  restore: async () => false,
  // No store to ask, so the paywall keeps the backend's fallback price.
  termsFor: () => null,
};

export default function useStorePurchase() {
  return NOT_SUPPORTED;
}
