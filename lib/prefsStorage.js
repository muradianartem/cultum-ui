// Device preferences — appearance, the global reminder time, and the
// notifications master switch.
//
// These live in their own document rather than in the garden for one reason:
// `store/persist.js#clearState()` deletes the garden on sign-out (App.js), and
// a preference is a property of the *device*, not the account. Which theme the
// phone is in should not be forgotten because somebody logged out.
//
// Read synchronously. `expo-file-system`'s File exposes `textSync()`, and the
// whole document is a couple of hundred bytes, so the first render already has
// the real values — there is no loading gate and therefore no flash of the
// wrong theme on launch. Writes go through the same tmp + move dance as the
// garden (store/persist.js), so a crash mid-write leaves the old document
// intact rather than a truncated one.
//
// A caveat worth stating out loud: these are device-level, not account-level.
// There is no `GET /users/me` and the app never reads a user id out of its
// tokens, so there is nothing to key them on. For appearance that is the right
// answer anyway; for the reminder time it means a second account on the same
// phone inherits the first one's default until they change it.

import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'cultum-prefs.json';
const TMP_NAME = 'cultum-prefs.tmp.json';

/** Bump when the shape changes; `migratePrefs` fills the gaps. */
export const PREFS_VERSION = 1;

export const DEFAULT_PREFS = Object.freeze({
  version: PREFS_VERSION,
  /** 'system' follows the OS; 'light' / 'dark' pin it. */
  appearance: 'system',
  /** "HH:mm", device local. The default time new reminders fire at. */
  reminderTime: '09:00',
  /** The master switch over OS delivery — never over a reminder's own `enabled`. */
  notificationsEnabled: true,
});

const APPEARANCES = new Set(['system', 'light', 'dark']);
const isTimeOfDay = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// Resolved lazily and reused: Paths.document is fixed for the life of the
// process, but reading it at module scope would run before the test mock is in
// place. Same reasoning as store/media.js's documentRoot().
const prefsFile = () => new File(Paths.document, FILE_NAME);
const tmpFile = () => new File(Paths.document, TMP_NAME);

/**
 * Fill in anything a stored document is missing, and drop anything it got
 * wrong. Unlike the garden — where a malformed field would cost the user their
 * plants — a bad preference is worth silently replacing with its default.
 */
export function migratePrefs(doc) {
  if (!doc || typeof doc !== 'object') return { ...DEFAULT_PREFS };
  if (Number(doc.version) > PREFS_VERSION) return { ...DEFAULT_PREFS };
  return {
    version: PREFS_VERSION,
    appearance: APPEARANCES.has(doc.appearance) ? doc.appearance : DEFAULT_PREFS.appearance,
    reminderTime: isTimeOfDay(doc.reminderTime) ? doc.reminderTime : DEFAULT_PREFS.reminderTime,
    notificationsEnabled:
      typeof doc.notificationsEnabled === 'boolean'
        ? doc.notificationsEnabled
        : DEFAULT_PREFS.notificationsEnabled,
  };
}

/**
 * The preferences as they were left. Never throws and never returns null: a
 * first launch and an unreadable document both mean "the defaults", and this
 * runs inside a useState initialiser where there is nobody to catch anything.
 */
export function loadPrefsSync() {
  try {
    const file = prefsFile();
    if (!file.exists) return { ...DEFAULT_PREFS };
    return migratePrefs(JSON.parse(file.textSync()));
  } catch (e) {
    console.warn('[prefs] could not read preferences, using defaults:', e?.message ?? e);
    return { ...DEFAULT_PREFS };
  }
}

/** Write the preferences. Returns false rather than throwing. */
export async function savePrefs(prefs) {
  try {
    const tmp = tmpFile();
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify({ ...prefs, version: PREFS_VERSION }));
    tmp.moveSync(prefsFile(), { overwrite: true });
    return true;
  } catch (e) {
    console.warn('[prefs] could not save preferences:', e?.message ?? e);
    return false;
  }
}

/**
 * Forget the preferences.
 *
 * Deliberately NOT called on sign-out — that is the whole point of this file
 * living outside the garden document. It exists for tests.
 */
export function clearPrefs() {
  try {
    const file = prefsFile();
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('[prefs] could not clear preferences:', e?.message ?? e);
  }
}
