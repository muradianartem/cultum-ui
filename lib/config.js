// Runtime config sourced from app.json > expo.extra (via expo-constants). Holds
// no true secrets — public OAuth client IDs + the public API base URL — so dev
// values are committed in app.json; override there per environment.
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

/** The dev backend — the last resort when neither the env nor app.json names one. */
const DEV_API_BASE_URL =
  'https://ca-cultum-dev-cac.redsand-9719b340.canadacentral.azurecontainerapps.io';

/**
 * The backend every request goes to. The one place it is decided:
 * `EXPO_PUBLIC_API_BASE_URL` (per build/shell) wins, then app.json
 * `extra.apiBaseUrl`, then the dev backend.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || DEV_API_BASE_URL;

export const GOOGLE_CLIENT_IDS = {
  web: extra.googleWebClientId,
  ios: extra.googleIosClientId,
  android: extra.googleAndroidClientId,
};

/**
 * The Google OAuth client id for a platform, or null when this build has none.
 *
 * app.json ships `REPLACE_WITH_…` placeholders for ids nobody has created yet.
 * expo-auth-session throws on a missing id for the current platform, and a
 * placeholder would build an OAuth request Google rejects — either way the
 * caller should not offer Google sign-in at all.
 */
export function googleClientIdFor(platform = Platform.OS) {
  const id = GOOGLE_CLIENT_IDS[platform];
  return id && !id.includes('REPLACE_WITH') ? id : null;
}

/**
 * PostHog project key and ingestion host. A project key is public (it can only
 * send events), but none is committed: with no key, lib/analytics.js does
 * nothing, so a build only reports once a key is given to it —
 * `EXPO_PUBLIC_POSTHOG_KEY` per build/shell, or app.json `extra.posthogKey`.
 */
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || extra.posthogKey || null;
export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || extra.posthogHost || 'https://us.i.posthog.com';
