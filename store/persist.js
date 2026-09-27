// The garden's mirror on disk.
//
// Not an offline store. Nothing is ever edited here first: the file only
// holds the last garden the server returned, plus the few device-only fields
// (store/fromServer.js), for two jobs:
//   • reminders are local OS notifications scheduled by this app, so their
//     schedule has to be rebuildable when the server cannot be reached;
//   • the device-only fields have nowhere else to live.
// Screens never render from it — GardenProvider shows a loader until the
// server answers.
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
 * A stored document as the current shape, with `status: 'loading'` — a mirror
 * is never taken as the server's current answer.
 *
 * Documents from the offline-first builds (v1, v2) keep only what the server
 * already had: rows with a `serverId`, re-keyed to it, and their device-only
 * fields. Their outbox, their rejected writes and any row that never reached
 * the server are dropped — the server is the source of truth from here on.
 * A document from a *newer* version (a downgrade) starts over.
 */
export function migrate(doc) {
  if (!doc || typeof doc !== 'object') return emptyState();
  if (Number(doc.version) > STATE_VERSION) return emptyState();
  const base = emptyState();
  const list = (x) => (Array.isArray(x) ? x : []);

  if (Number(doc.version ?? 0) >= 3) {
    return {
      ...base,
      plants: list(doc.plants),
      reminders: list(doc.reminders),
      rooms: list(doc.rooms),
      profileName: doc.profileName ?? null,
    };
  }

  const rooms = list(doc.rooms).filter((r) => r?.serverId);
  const plants = list(doc.plants).filter((p) => p?.serverId);
  const roomIds = new Map(rooms.map((r) => [r.id, r.serverId]));
  const plantIds = new Map(plants.map((p) => [p.id, p.serverId]));
  return {
    ...base,
    profileName: doc.profileName ?? null,
    rooms: rooms.map((r) => ({
      id: r.serverId,
      name: r.name,
      icon: r.icon ?? null,
      light: r.light ?? 'unknown',
      sortOrder: r.sortOrder ?? 0,
    })),
    plants: plants.map((p) => ({
      id: p.serverId,
      speciesKey: p.speciesKey ?? null,
      nickname: p.nickname,
      roomId: roomIds.get(p.roomId) ?? null,
      acquiredAt: p.acquiredAt ?? null,
      care: p.care ?? null,
      heroUri: p.heroUri ?? null,
      photoUri: p.photoUri ?? null,
      imageFile: p.imageFile ?? null,
    })),
    reminders: list(doc.reminders)
      .filter((r) => r?.serverId && plantIds.has(r.plantId))
      .map((r) => ({
        id: r.serverId,
        plantId: plantIds.get(r.plantId),
        action: r.action,
        title: r.title,
        intervalDays: r.intervalDays,
        timeOfDay: r.timeOfDay,
        enabled: r.enabled !== false,
        startAt: r.startAt ?? null,
        lastDoneAt: r.lastDoneAt ?? null,
        snoozedUntil: r.snoozedUntil ?? null,
      })),
  };
}

/**
 * The garden as the server last described it. A missing or unreadable file is
 * an empty garden, never an error.
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

/** What goes to disk: the lists and the name, never the load status. */
const toDocument = ({ plants, reminders, rooms, profileName }) => ({
  version: STATE_VERSION,
  plants,
  reminders,
  rooms,
  profileName: profileName ?? null,
});

/** Write the garden. Returns false rather than throwing — a failed save must
 *  never take down the screen that triggered it. */
export async function saveState(state) {
  try {
    const tmp = tmpFile();
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify(toDocument(state)));
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
 * Several changes can land in one interaction (adding a plant upserts it and
 * each of its reminders). Coalescing them keeps a burst to a single write, and
 * `flush()` lets the caller force one out — on background, say, where the next
 * event may be the process being killed.
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
