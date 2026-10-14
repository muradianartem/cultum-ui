// Which lapses the user has already been told about.
//
// The "Your free trial has ended" screen is shown once per lapse
// (billing/lapse.js#planLapse's `key`), and "once" has to survive a relaunch.
// The keys embed the store subscription's id, which is unique across accounts,
// so this describes the device and is not cleared on sign-out — another account
// signing in here cannot collide with them.
//
// Synchronous for the same reason as lib/entitlementCache.js: it is read when
// the launcher decides, and an async read would mean deciding twice.

import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'cultum-plan-lapse-ack.json';
// A lapse per resubscription cycle; a handful is a lifetime.
const MAX_KEYS = 20;

const ackFile = () => new File(Paths.document, FILE_NAME);

function readKeys() {
  try {
    const file = ackFile();
    if (!file.exists) return [];
    const doc = JSON.parse(file.textSync());
    return Array.isArray(doc?.keys) ? doc.keys.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether the lapse named `key` has been acknowledged on this device. */
export function isLapseAcknowledged(key) {
  return !!key && readKeys().includes(key);
}

/** Remember that the user has seen and answered the notice for `key`. */
export function acknowledgeLapse(key) {
  if (!key) return;
  try {
    const keys = readKeys().filter((k) => k !== key);
    keys.push(key);
    const file = ackFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify({ keys: keys.slice(-MAX_KEYS) }));
  } catch (e) {
    console.warn('[billing] could not record the lapse notice:', e?.message ?? e);
  }
}
