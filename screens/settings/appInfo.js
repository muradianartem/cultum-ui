// What the About screen and the Settings row say about this build.
//
// Version and build come from the native bundle rather than package.json: they
// are what the user would quote in a bug report and what App Store Connect
// shows, and in a TestFlight build the build number is the only thing that
// distinguishes two uploads of the same version.

import * as Application from 'expo-application';

/** "1.0.6" — CFBundleShortVersionString. */
export const APP_VERSION = Application.nativeApplicationVersion ?? '—';

/** "42" — CFBundleVersion. Null on web, where there is no native bundle. */
export const APP_BUILD = Application.nativeBuildVersion ?? '—';

/**
 * Where the legal pages live. Opened in an in-app browser, not Safari.
 *
 * GET /billing/plans serves the Terms and Privacy URLs too, and those win where
 * the app has them (billing/legal.js); these are what the screens use before
 * the backend has answered, which on the Login screen is the usual case.
 */
export const LEGAL_LINKS = [
  { key: 'privacy', title: 'Privacy Policy', value: 'cultum.app/privacy', url: 'https://cultum.app/privacy' },
  { key: 'terms', title: 'Terms of Use', value: 'cultum.app/terms', url: 'https://cultum.app/terms' },
  { key: 'licences', title: 'Licences', value: 'cultum.app/licences', url: 'https://cultum.app/licences' },
];

/** The address on the Contact us card. */
export { SUPPORT_EMAIL } from '../../lib/support';
