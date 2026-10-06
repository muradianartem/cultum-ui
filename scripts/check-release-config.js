#!/usr/bin/env node
// Pre-release sanity check of app.json for one platform.
//
//   node scripts/check-release-config.js --platform ios|android
//
// Errors (exit 1) are only what breaks the platform being built: a non-HTTPS
// API URL, a missing or placeholder Google client id for that platform, or no
// bundle identifier / package. Everything else is a warning (exit 0) — notably
// the dev backend, since there is no production one yet and failing on it
// would block every TestFlight build.

const fs = require('fs');
const path = require('path');

/**
 * @param {object} appJson   the parsed app.json
 * @param {object} env       process.env (reads EXPO_PUBLIC_API_BASE_URL)
 * @param {'ios'|'android'} platform
 * @param {{ packageVersion?: string }} [extra]
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validate(appJson, env, platform, { packageVersion } = {}) {
  const errors = [];
  const warnings = [];
  const expo = appJson?.expo ?? {};
  const extra = expo.extra ?? {};

  // Same precedence as lib/config.js, which owns the last-resort default.
  const apiUrl = env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl;
  if (!apiUrl) warnings.push("no API URL configured; the app falls back to lib/config.js's dev backend");
  else if (!/^https:\/\//.test(apiUrl)) errors.push(`API URL is not https: ${apiUrl}`);
  else if (apiUrl.includes('-dev-')) warnings.push(`API URL points at the dev backend: ${apiUrl}`);

  const clientKey = platform === 'ios' ? 'googleIosClientId' : 'googleAndroidClientId';
  const clientId = extra[clientKey];
  if (!clientId) errors.push(`expo.extra.${clientKey} is missing`);
  else if (clientId.includes('REPLACE_WITH')) errors.push(`expo.extra.${clientKey} is a placeholder: ${clientId}`);

  if (platform === 'ios' && !expo.ios?.bundleIdentifier) errors.push('expo.ios.bundleIdentifier is missing');
  if (platform === 'android' && !expo.android?.package) errors.push('expo.android.package is missing');

  if (packageVersion && expo.version && packageVersion !== expo.version) {
    warnings.push(`package.json version ${packageVersion} ≠ app.json expo.version ${expo.version}`);
  }
  return { errors, warnings };
}

function main(argv) {
  const i = argv.indexOf('--platform');
  const platform = i >= 0 ? argv[i + 1] : null;
  if (platform !== 'ios' && platform !== 'android') {
    console.error('usage: check-release-config.js --platform ios|android');
    return 2;
  }
  const root = path.resolve(__dirname, '..');
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const { errors, warnings } = validate(appJson, process.env, platform, { packageVersion: version });

  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(errors.length ? `${platform}: ${errors.length} error(s)` : `${platform}: config OK`);
  return errors.length ? 1 : 0;
}

module.exports = { validate };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
