const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Escape hatch: make the app signable by a *personal* Apple team.
 *
 * OFF BY DEFAULT, and deliberately not wired into any npm script — the app's
 * real identity is `com.cultum.ui`, which is what the Google OAuth client is
 * bound to (console.cloud.google.com → iOS client 1, bundle id updated
 * 2026-09-13). Use this only to get a build onto a device when signing as
 * `com.cultum.ui` is not possible, and expect Google sign-in to fail in it —
 * `DEV_BYPASS_AUTH` in auth/AuthProvider.js is the way in.
 *
 * This Mac has exactly one iOS development certificate — "Apple Development:
 * Artem Muradian", a personal team (YD8L3P337P). The real app belongs to the
 * paid team behind certs/cultum.mobileprovision (R2DMSF49SA), which is what EAS
 * signs release builds with. A personal team cannot stand in for it unchanged,
 * for two reasons, and this plugin answers both:
 *
 * 1. `com.cultum.ui` is already registered to that paid team, and App IDs are
 *    globally unique — so the personal team cannot register it at any price
 *    ("Failed Registering Bundle Identifier … not available"). Local builds use
 *    LOCAL_BUNDLE_ID instead, which this Mac already holds a profile for. As a
 *    bonus it is the id the Google OAuth iOS client is still bound to, so
 *    Google sign-in works on a device build even while it is broken for
 *    `com.cultum.ui`.
 *
 * 2. Personal teams support neither Push Notifications nor Sign in with Apple,
 *    and Xcode refuses to create a profile at all when the entitlements ask for
 *    a capability the team lacks. Both keys are dropped below. Little is lost:
 *    the app only ever schedules *local* notifications (notifications/index.js
 *    never asks for a push token), which need no entitlement — remote push
 *    would. Sign in with Apple is simply inert in a build signed this way.
 *
 * Opt in with CULTUM_LOCAL_SIGNING=1 (`npm run ios:device` sets it), so EAS
 * builds keep the real bundle id and every entitlement untouched.
 *
 * NOTE: this is listed *first* in app.json's plugins on purpose. Config-plugin
 * mods wrap each other, so the last one registered runs first — registering
 * this one first is what makes its entitlements mod run last, after
 * expo-notifications and expo-apple-authentication have written their keys.
 */

/** The id this Mac's personal team can sign — the app's pre-rename identifier. */
const LOCAL_BUNDLE_ID = 'com.artemmuradan.cultumui';

const UNSIGNABLE = ['aps-environment', 'com.apple.developer.applesignin'];

module.exports = function withLocalDevSigning(config) {
  if (process.env.CULTUM_LOCAL_SIGNING !== '1') return config;

  const local = { ...config, ios: { ...config.ios, bundleIdentifier: LOCAL_BUNDLE_ID } };

  return withEntitlementsPlist(local, (cfg) => {
    for (const key of UNSIGNABLE) delete cfg.modResults[key];
    return cfg;
  });
};
