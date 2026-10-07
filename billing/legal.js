// The Terms of Use and Privacy Policy URLs, wherever a screen needs them.
//
// The backend serves them with the paywall (GET /billing/plans → `legal`) so a
// page can move without an app release. Until that payload has landed — and
// the Login screen usually renders before it has — the bundled links in
// screens/settings/appInfo.js stand in, so a legal link is never dead.

import { LEGAL_LINKS } from '../screens/settings/appInfo';

/**
 * @param {object|null} content  mapped paywall content, or null
 * @param {'terms'|'privacy'} key
 * @returns {string|null}
 */
export function legalUrl(content, key) {
  const served = content?.legal?.find((link) => link.key === key)?.url;
  return served ?? LEGAL_LINKS.find((link) => link.key === key)?.url ?? null;
}
