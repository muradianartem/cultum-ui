// Runtime config sourced from app.json > expo.extra (via expo-constants). Holds
// no true secrets — public OAuth client IDs + the public API base URL — so dev
// values are committed in app.json; override there per environment.
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const GOOGLE_CLIENT_IDS = {
  web: extra.googleWebClientId,
  ios: extra.googleIosClientId,
  android: extra.googleAndroidClientId,
};
