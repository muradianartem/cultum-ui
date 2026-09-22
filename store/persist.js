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
import { LEGACY_DEFAULT_ROOM_IDS, STATE_VERSION, emptyState, iconForRoomName } from './model';
import { enqueue } from './reducer';

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
  const migrated = {
    ...base,
    ...doc,
    version: STATE_VERSION,
    plants: Array.isArray(doc.plants)
      ? doc.plants.map((p) => ({ dirty: {}, imageFile: null, ...p }))
      : [],
    reminders: Array.isArray(doc.reminders) ? doc.reminders : [],
    rooms: Array.isArray(doc.rooms) ? doc.rooms : base.rooms,
    outbox: Array.isArray(doc.outbox) ? doc.outbox : [],
    // Optional and additive, so older documents need no version bump for it.
    failed: Array.isArray(doc.failed) ? doc.failed : [],
  };
  return Number(doc.version ?? 0) < 2 ? roomsFromV1(migrated) : migrated;
}

/**
 * v1 → v2: rooms stop being local-only.
 *
 * v1 seeded every install with five stock rooms and told the server a plant's
 * room only as a free-text `location`. So: the stock rooms nobody used go; the
 * rest are queued for creation (sync adopts a same-named server room rather
 * than duplicating it); and every synced plant with a room is queued for a
 * PATCH, because the server has no `room_id` for it yet and the first pull
 * would otherwise take its room away. Local rename/move dirt is folded into
 * that same push, leaving `dirty` for `archived` alone.
 */
function roomsFromV1(doc) {
  const used = new Set(doc.plants.map((p) => p.roomId).filter(Boolean));
  const rooms = doc.rooms
    .filter((r) => r && (!LEGACY_DEFAULT_ROOM_IDS.includes(r.id) || used.has(r.id)))
    .map((r, i) => ({
      ...r,
      serverId: r.serverId ?? null,
      icon: r.icon ?? iconForRoomName(r.name),
      light: r.light ?? 'unknown',
      sortOrder: r.sortOrder ?? i,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  const known = new Set(rooms.map((r) => r.id));

  let outbox = doc.outbox;
  for (const r of rooms) if (!r.serverId) outbox = enqueue(outbox, 'room.create', r.id);

  const plants = doc.plants.map((p) => {
    const { nickname: _n, roomId: _r, ...dirty } = p.dirty ?? {};
    const next = { ...p, dirty };
    // A plant pointing at a stock room that was just dropped can't have been
    // using it — but guard anyway rather than leave a dangling id.
    if (p.roomId && !known.has(p.roomId)) next.roomId = null;
    if (p.serverId && (next.roomId || p.dirty?.nickname || p.dirty?.roomId)) {
      outbox = enqueue(outbox, 'plant.update', p.id, p.serverId);
    }
    return next;
  });

  return { ...doc, rooms, plants, outbox };
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
