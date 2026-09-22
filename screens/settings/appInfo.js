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

/** Where the legal pages live. Opened in an in-app browser, not Safari. */
export const LEGAL_LINKS = [
  { title: 'Privacy Policy', value: 'cultum.app/privacy', url: 'https://cultum.app/privacy' },
  { title: 'Terms of Use', value: 'cultum.app/terms', url: 'https://cultum.app/terms' },
  { title: 'Licences', value: 'cultum.app/licences', url: 'https://cultum.app/licences' },
];

/** The address on the Contact us card. */
export { SUPPORT_EMAIL } from '../../lib/support';
