// Reading and writing the garden document.
//
// The whole garden is one JSON file in the app's document directory, which is
// what expo-file-system suits and what a local-first app of this size needs:
// no schema, no migrations beyond a version stamp, and a single atomic write.
//
// expo-file-system was already linked into the native project (it ships as a
// dependency of `expo` itself), so this needed no new native module.
//
// Writes go to a sibling `.tmp` and are moved over the target with
// `overwrite: true`, so a crash mid-write leaves the previous document intact
// rather than a truncated one.

import { File, Paths } from 'expo-file-system';
import { STATE_VERSION, emptyState } from './model';

const FILE_NAME = 'cultum-garden.json';
const TMP_NAME = 'cultum-garden.tmp.json';

const gardenFile = () => new File(Paths.document, FILE_NAME);
const tmpFile = () => new File(Paths.document, TMP_NAME);

/**
 * Fill in anything a stored document is missing.
 *
 * A document from an older build is worth keeping even when its shape has
 * drifted — a user's plants are not something to drop because a field was
 * added — so this fills gaps rather than rejecting. A document from a *newer*
 * version (a downgrade) is the one case we can't reason about, and starts over.
 */
export function migrate(doc) {
  if (!doc || typeof doc !== 'object') return emptyState();
  if (Number(doc.version) > STATE_VERSION) return emptyState();

  const base = emptyState();
  return {
    ...base,
    ...doc,
    version: STATE_VERSION,
    plants: Array.isArray(doc.plants) ? doc.plants.map((p) => ({ dirty: {}, ...p })) : [],
    reminders: Array.isArray(doc.reminders) ? doc.reminders : [],
    rooms: Array.isArray(doc.rooms) && doc.rooms.length ? doc.rooms : base.rooms,
    outbox: Array.isArray(doc.outbox) ? doc.outbox : [],
  };
}

/**
 * The garden as it was left. A missing or unreadable file is an empty garden,
 * never an error: a first launch and a corrupt document should both land the
 * user on a working, if bare, app.
 */
export async function loadState() {
  try {
    const file = gardenFile();
    if (!file.exists) return emptyState();
    return migrate(JSON.parse(await file.text()));
  } catch (e) {
    console.warn('[store] could not read the garden, starting empty:', e?.message ?? e);
    return emptyState();
  }
}

/** Write the garden. Returns false rather than throwing — a failed save must
 *  never take down the screen that triggered it. */
export async function saveState(state) {
  try {
    const tmp = tmpFile();
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify(state));
    tmp.moveSync(gardenFile(), { overwrite: true });
    return true;
  } catch (e) {
    console.warn('[store] could not save the garden:', e?.message ?? e);
    return false;
  }
}

/** Forget everything on disk (sign-out). */
export async function clearState() {
  try {
    const file = gardenFile();
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('[store] could not clear the garden:', e?.message ?? e);
  }
}

/**
 * A debounced writer.
 *
 * Every mutation dispatches, and several land in one interaction (completing a
 * task stamps a reminder and drains a snooze). Coalescing them keeps a burst to
 * a single write, and `flush()` lets the caller force one out — on background,
 * say, where the next event may be the process being killed.
 */
export function createSaver(delay = 400, save = saveState) {
  let timer = null;
  let pending = null;

  const write = () => {
    timer = null;
    const state = pending;
    pending = null;
    if (state) save(state);
  };

  return {
    queue(state) {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, delay);
    },
    flush() {
      if (timer) clearTimeout(timer);
      write();
    },
  };
}
