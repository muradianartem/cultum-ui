// Last-known entitlement, kept on disk.
//
// The Settings screen decides whether to show an upgrade pitch, and the
// subscription guard decides whether to open a paywall — both on the first
// render, long before GET /users/me/subscription can answer. Starting from the
// last thing the server said is the difference between a paying subscriber
// seeing their own settings and a paying subscriber being sold something they
// already own.
//
// Its own document rather than a field on the garden, so nothing in billing has
// to know the garden's shape. Unlike lib/prefsStorage.js this one IS cleared on
// sign-out (App.js): it describes an account, not a device.

import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'cultum-entitlement.json';
const TMP_NAME = 'cultum-entitlement.tmp.json';

const cacheFile = () => new File(Paths.document, FILE_NAME);
const tmpFile = () => new File(Paths.document, TMP_NAME);

/**
 * The cached EntitlementOut, or null if there isn't one.
 *
 * Synchronous, for the same reason the preferences are: it is read inside a
 * useState initialiser, and an async read would mean a frame of "we don't know"
 * on every launch.
 */
export function loadEntitlementSync() {
  try {
    const file = cacheFile();
    if (!file.exists) return null;
    const doc = JSON.parse(file.textSync());
    // `is_plus` is the one field every consumer reads; a document without it is
    // not worth trusting.
    return typeof doc?.is_plus === 'boolean' ? doc : null;
  } catch {
    return null;
  }
}

/** Replace the cache. Only ever called with a definitive 200. */
export function saveEntitlement(dto) {
  try {
    const tmp = tmpFile();
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify(dto));
    tmp.moveSync(cacheFile(), { overwrite: true });
    return true;
  } catch (e) {
    console.warn('[billing] could not cache the entitlement:', e?.message ?? e);
    return false;
  }
}

/** Forget it (sign-out). */
export function clearEntitlement() {
  try {
    const file = cacheFile();
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('[billing] could not clear the entitlement:', e?.message ?? e);
  }
}
