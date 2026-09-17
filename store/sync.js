// Pushing local changes to the backend and pulling the garden back.
//
// Local-first: every mutation has already been applied and persisted by the
// time this runs. Sync is best-effort catch-up, never a gate — the app is fully
// usable with the radio off, and a failed sync leaves the queue intact for the
// next attempt.
//
// Two shapes of work:
//   1. drain the outbox, in order, translating each queued intent into a call;
//   2. pull GET /users/me/rooms and GET /users/me/plants and merge them over
//      local state.
//
// The merge has to be careful in one specific way: anything with a queued push
// is newer here than on the server, so the pull must not overwrite it. A plant's
// `archived` has no server column at all, so it is marked dirty instead and
// never taken from the server.

import * as gardenApi from '../api/garden';
import * as roomsApi from '../api/rooms';
import { mediaUrl } from '../api/mapPlant';
import { DEFAULT_TIME_OF_DAY, actionMeta, iconForRoomName, uid } from './model';
import { enqueue } from './outbox';

const defaultApi = { ...gardenApi, ...roomsApi };

// ---------------------------------------------------------------------------
// Server ⇄ local translation
// ---------------------------------------------------------------------------

/** ReminderType → the local action it most likely came from. */
const ACTION_FOR_TYPE = {
  watering: 'water',
  fertilize: 'fertilize',
  soil_change: 'repot',
  custom: 'custom',
};

/**
 * A reminder the server knows about but this device doesn't.
 *
 * Anything past the three native types round-trips as `custom`, so a "Prune"
 * created on another device arrives as a generic reminder. Its title lives only
 * on the device that made it — there is nowhere on ReminderOut to put it.
 */
function reminderFromServer(dto, plantId, now) {
  const action = ACTION_FOR_TYPE[dto.type] ?? 'custom';
  const meta = actionMeta(action);
  return {
    id: uid('rem'),
    serverId: dto.id,
    plantId,
    action,
    title: meta.label,
    intervalDays: dto.interval_days,
    timeOfDay: dto.time_of_day ? String(dto.time_of_day).slice(0, 5) : DEFAULT_TIME_OF_DAY,
    enabled: dto.enabled !== false,
    startAt: now,
    lastDoneAt: dto.last_done_at ?? null,
    snoozedUntil: null,
    createdAt: now,
    updatedAt: now,
  };
}

function plantFromServer(dto, roomId, now) {
  return {
    id: uid('plant'),
    serverId: dto.id,
    speciesKey: dto.species_key,
    nickname: dto.nickname ?? dto.common_name ?? dto.scientific_name ?? 'Plant',
    roomId,
    acquiredAt: dto.acquired_at ?? null,
    care: dto.care ?? null,
    // Absolutised on the way in: UserPlantOut carries the catalog's own
    // root-relative '/media/...' path, which <Image> cannot load.
    heroUri: mediaUrl(dto.image_url ?? dto.care?.image_url),
    photoUri: null,
    imageFile: null,
    archived: false,
    dirty: {},
    createdAt: now,
    updatedAt: now,
  };
}

function roomFromServer(dto, now) {
  return {
    id: uid('room'),
    serverId: dto.id,
    name: dto.name,
    icon: dto.icon || iconForRoomName(dto.name),
    light: dto.light ?? 'unknown',
    sortOrder: dto.sort_order ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

// A failure that means "the network isn't there" — stop and keep the queue.
// Anything else is the server rejecting this particular entry, which retrying
// forever would never fix, so it is dropped after being logged.
const isTransient = (e) =>
  e?.code === 'offline' || e?.code === 'network' || e?.code === 'timeout' || e?.status >= 500;

// The plan's room ceiling. Free users get one room; the create UI checks the
// entitlement first, so reaching this means a stale cache or a second device.
const isPlanLimit = (e) => e?.status === 402 || e?.status === 403;

/**
 * Send everything queued, in order.
 *
 * Payloads are read from the *current* state rather than snapshotted at queue
 * time, so a row edited three times before a connection appears is pushed once,
 * with its final values.
 *
 * @returns {{ state: object, stopped: boolean }}
 */
/** How many queued writes one sync round will push before yielding. */
export const MAX_PUSH_PER_ROUND = 25;

export async function drainOutbox(state, api = defaultApi) {
  let next = state;
  let stopped = false;
  // Bounded on purpose. Changing the global reminder time queues one update per
  // reminder, and this loop is serial: fifty of them is fifteen-odd seconds
  // during which no other sync can start and an iOS backgrounding can kill the
  // whole run. A slice at a time survives that — GardenProvider's sync effect
  // is keyed on `state.outbox`, so committing a shorter one re-triggers it, and
  // it terminates because the queue strictly shrinks.
  const queue = next.outbox.slice(0, MAX_PUSH_PER_ROUND);
  const budgeted = next.outbox.length > queue.length;
  // Per-drain scratch: the server's room list, fetched at most once and only if
  // a room create needs to check for a same-named room first.
  const ctx = { remoteRooms: null };

  for (const entry of queue) {
    try {
      next = await pushOne(next, entry, api, ctx);
      next = { ...next, outbox: next.outbox.filter((e) => e !== entry) };
    } catch (e) {
      if (isTransient(e)) {
        stopped = true;
        break;
      }
      console.warn(`[sync] dropping ${entry.op} for ${entry.localId}: ${e?.message ?? e}`);
      next = { ...next, outbox: next.outbox.filter((e2) => e2 !== entry) };
    }
  }
  // A budgeted round reports as stopped: there is more to push, so the pull
  // must wait — merging now would take the server's values as authoritative for
  // rows whose updates are still sitting in the queue.
  return { state: next, stopped: stopped || (budgeted && next.outbox.length > 0) };
}

/**
 * The server id to send as a plant's `room_id`.
 *
 * `pending` means the plant's room exists here but hasn't been created on the
 * server yet — the caller re-queues rather than pushing the plant roomless.
 */
function roomRef(state, plant) {
  if (!plant.roomId) return { serverId: null, pending: false };
  const room = state.rooms.find((r) => r.id === plant.roomId);
  if (!room) return { serverId: null, pending: false };
  return { serverId: room.serverId ?? null, pending: !room.serverId };
}

/** Forget a room the server refused to create, leaving its plants roomless. */
export function dropRoom(state, roomId) {
  return {
    ...state,
    rooms: state.rooms.filter((r) => r.id !== roomId),
    plants: state.plants.map((p) => (p.roomId === roomId ? { ...p, roomId: null } : p)),
  };
}

async function pushOne(state, entry, api, ctx) {
  switch (entry.op) {
    case 'room.create': {
      const room = state.rooms.find((r) => r.id === entry.localId);
      if (!room || room.serverId) return state;

      // A room of the same name the server already has — made on another
      // device, or by a build that kept rooms local — is adopted rather than
      // duplicated.
      if (!ctx.remoteRooms) ctx.remoteRooms = (await api.listRooms()) ?? [];
      const claimed = new Set(state.rooms.map((r) => r.serverId).filter(Boolean));
      let dto = ctx.remoteRooms.find((d) => !claimed.has(d.id) && sameName(d.name, room.name));

      if (!dto) {
        try {
          dto = await api.createRoom({
            name: room.name,
            icon: room.icon,
            light: room.light,
            sortOrder: room.sortOrder,
          });
        } catch (e) {
          if (!isPlanLimit(e)) throw e;
          console.warn(`[sync] room "${room.name}" is over the plan's limit; removing it`);
          return dropRoom(state, room.id);
        }
        ctx.remoteRooms = [...ctx.remoteRooms, dto];
      }
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === room.id ? { ...r, serverId: dto.id } : r)),
      };
    }

    case 'room.update': {
      const room = state.rooms.find((r) => r.id === entry.localId);
      if (!room?.serverId) return state;
      await api.updateRoom(room.serverId, {
        name: room.name,
        icon: room.icon,
        light: room.light,
        sortOrder: room.sortOrder,
      });
      return state;
    }

    case 'room.delete':
      await api.deleteRoom(entry.serverId);
      return state;

    case 'plant.create': {
      const plant = state.plants.find((p) => p.id === entry.localId);
      if (!plant || plant.serverId) return state; // gone, or already pushed
      const room = roomRef(state, plant);
      if (room.pending) {
        return { ...state, outbox: enqueue(state.outbox, 'plant.create', plant.id) };
      }
      const dto = await api.addPlant({
        speciesKey: plant.speciesKey,
        nickname: plant.nickname,
        roomId: room.serverId,
        acquiredAt: plant.acquiredAt,
      });
      return {
        ...state,
        plants: state.plants.map((p) =>
          // The server now holds these values, so they are no longer local-only.
          p.id === plant.id ? { ...p, serverId: dto.id, dirty: {} } : p,
        ),
      };
    }

    case 'plant.update': {
      const plant = state.plants.find((p) => p.id === entry.localId);
      if (!plant?.serverId) return state;
      const room = roomRef(state, plant);
      if (room.pending) {
        return { ...state, outbox: enqueue(state.outbox, 'plant.update', plant.id, plant.serverId) };
      }
      await api.updatePlant(plant.serverId, { nickname: plant.nickname, roomId: room.serverId });
      return state;
    }

    case 'plant.delete':
      await api.removePlant(entry.serverId);
      return state;

    case 'reminder.create': {
      const reminder = state.reminders.find((r) => r.id === entry.localId);
      if (!reminder || reminder.serverId) return state;
      const plant = state.plants.find((p) => p.id === reminder.plantId);
      // Its plant hasn't reached the server yet. Put the intent back on the
      // queue rather than letting the drain retire it — dropping it here would
      // strand the reminder on this device forever.
      if (!plant?.serverId) {
        return { ...state, outbox: enqueue(state.outbox, 'reminder.create', reminder.id) };
      }
      const dto = await api.createReminder(plant.serverId, {
        type: actionMeta(reminder.action).serverType,
        intervalDays: reminder.intervalDays,
        timeOfDay: reminder.timeOfDay,
        enabled: reminder.enabled,
      });
      return {
        ...state,
        reminders: state.reminders.map((r) =>
          r.id === reminder.id ? { ...r, serverId: dto.id } : r,
        ),
      };
    }

    case 'reminder.update': {
      const reminder = state.reminders.find((r) => r.id === entry.localId);
      if (!reminder?.serverId) return state;
      await api.updateReminder(reminder.serverId, {
        type: actionMeta(reminder.action).serverType,
        intervalDays: reminder.intervalDays,
        timeOfDay: reminder.timeOfDay,
        enabled: reminder.enabled,
      });
      return state;
    }

    case 'reminder.complete': {
      const reminder = state.reminders.find((r) => r.id === entry.localId);
      // Its create is still ahead of this in the queue and hasn't landed, so
      // there is nothing to complete yet. Re-queue rather than lose the fact.
      if (!reminder) return state;
      if (!reminder.serverId) {
        return { ...state, outbox: enqueue(state.outbox, 'reminder.complete', reminder.id) };
      }
      await api.completeReminder(reminder.serverId);
      return state;
    }

    case 'reminder.delete':
      await api.deleteReminder(entry.serverId);
      return state;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/** Server ids with a delete still waiting to push — never re-adopted by a pull. */
const queuedDeletes = (outbox, op) =>
  new Set(outbox.filter((e) => e.op === op).map((e) => e.serverId));

/**
 * Fold the server's garden into local state.
 *
 * Rules, in one place:
 *   • a plant is matched by `serverId`; one that has a serverId the server no
 *     longer lists was deleted elsewhere and goes too;
 *   • a plant with no serverId is a pending create and is left alone;
 *   • a remote plant nobody here knows is adopted, along with its reminders;
 *   • a plant's room is its `room_id`, looked up by the room's serverId;
 *   • server values win, except for rows with a queued push (the queue is
 *     newer) and fields the server has no column for (`title`, `snoozedUntil`,
 *     `photoUri`, `imageFile`, `archived`).
 *
 * `remoteRooms` is GET /users/me/rooms. Left out, rooms are not touched and a
 * plant keeps its room when the server names one this device doesn't know.
 */
export function mergeGarden(state, remote, now = new Date().toISOString(), remoteRooms) {
  const remoteById = new Map((remote ?? []).map((dto) => [dto.id, dto]));
  const queued = new Set(state.outbox.map((e) => e.localId));

  const rooms = remoteRooms ? mergeRooms(state, remoteRooms, queued, now) : state.rooms;
  const roomByServerId = new Map(rooms.filter((r) => r.serverId).map((r) => [r.serverId, r.id]));
  const liveRoomIds = new Set(rooms.map((r) => r.id));
  const roomFor = (dto, fallback) => {
    if (!dto.room_id) return null;
    return roomByServerId.get(dto.room_id) ?? (remoteRooms ? null : fallback);
  };

  const plants = [];
  const reminders = [];
  const keptPlantIds = new Set();

  for (const plant of state.plants) {
    if (!plant.serverId) {
      plants.push(plant);
      keptPlantIds.add(plant.id);
      continue;
    }
    const dto = remoteById.get(plant.serverId);
    if (!dto) continue; // deleted on another device

    remoteById.delete(plant.serverId);
    keptPlantIds.add(plant.id);

    const pending = queued.has(plant.id);
    // A room removed by this pull takes its plants out with it, even a plant
    // whose queued move pointed there — the server has already done the same.
    const localRoom = plant.roomId && liveRoomIds.has(plant.roomId) ? plant.roomId : null;

    plants.push({
      ...plant,
      speciesKey: dto.species_key ?? plant.speciesKey,
      care: dto.care ?? plant.care,
      heroUri: plant.heroUri ?? mediaUrl(dto.image_url ?? dto.care?.image_url),
      nickname: pending ? plant.nickname : dto.nickname ?? plant.nickname,
      roomId: pending ? localRoom : roomFor(dto, localRoom),
      acquiredAt: dto.acquired_at ?? plant.acquiredAt,
      updatedAt: now,
    });

    reminders.push(...mergeReminders(state, plant, dto.reminders ?? [], queued, now));
  }

  // Whatever is left in the map is new to this device — unless it is a plant
  // this device deleted and hasn't pushed yet, which must not come back.
  const deleting = queuedDeletes(state.outbox, 'plant.delete');
  for (const dto of remoteById.values()) {
    if (deleting.has(dto.id)) continue;
    const plant = plantFromServer(dto, roomFor(dto, null), now);
    plants.push(plant);
    keptPlantIds.add(plant.id);
    for (const r of dto.reminders ?? []) reminders.push(reminderFromServer(r, plant.id, now));
  }

  // A plant still waiting on its create may point at a room this pull removed.
  for (let i = 0; i < plants.length; i += 1) {
    const p = plants[i];
    if (!p.serverId && p.roomId && !liveRoomIds.has(p.roomId)) plants[i] = { ...p, roomId: null };
  }

  // Reminders whose plant survived but which the loop above never visited
  // (a plant still pending its own create) keep their rows.
  for (const r of state.reminders) {
    if (!r.serverId && keptPlantIds.has(r.plantId) && !reminders.some((x) => x.id === r.id)) {
      const owner = plants.find((p) => p.id === r.plantId);
      if (owner && !owner.serverId) reminders.push(r);
    }
  }

  return { ...state, plants, reminders, rooms, lastSyncAt: now };
}

/**
 * Fold GET /users/me/rooms into the local list — the same rules as reminders:
 * never-synced or queued rooms are this device's, a synced room the server no
 * longer lists was deleted elsewhere, and anything new is adopted.
 */
export function mergeRooms(state, remoteRooms, queued, now) {
  const byServerId = new Map((remoteRooms ?? []).map((d) => [d.id, d]));
  // A delete still waiting to push must not have its room re-adopted.
  const deleting = queuedDeletes(state.outbox, 'room.delete');
  const out = [];

  for (const room of state.rooms) {
    if (!room.serverId) {
      out.push(room);
      continue;
    }
    const dto = byServerId.get(room.serverId);
    if (!dto) continue; // deleted elsewhere
    byServerId.delete(room.serverId);
    if (queued.has(room.id)) {
      out.push(room);
      continue;
    }
    out.push({
      ...room,
      name: dto.name ?? room.name,
      // Only an icon the server actually sent replaces the local one.
      icon: dto.icon || room.icon || iconForRoomName(dto.name),
      light: dto.light ?? room.light,
      sortOrder: dto.sort_order ?? room.sortOrder,
    });
  }

  for (const dto of byServerId.values()) {
    if (!deleting.has(dto.id)) out.push(roomFromServer(dto, now));
  }
  return out;
}

function mergeReminders(state, plant, remoteReminders, queued, now) {
  const local = state.reminders.filter((r) => r.plantId === plant.id);
  const byServerId = new Map(remoteReminders.map((d) => [d.id, d]));
  const out = [];

  for (const reminder of local) {
    // Never synced, or has an unsent edit: this device is the newer authority.
    if (!reminder.serverId || queued.has(reminder.id)) {
      out.push(reminder);
      byServerId.delete(reminder.serverId);
      continue;
    }
    const dto = byServerId.get(reminder.serverId);
    if (!dto) continue; // deleted elsewhere
    byServerId.delete(reminder.serverId);
    out.push({
      ...reminder,
      intervalDays: dto.interval_days,
      timeOfDay: dto.time_of_day ? String(dto.time_of_day).slice(0, 5) : reminder.timeOfDay,
      enabled: dto.enabled !== false,
      lastDoneAt: dto.last_done_at ?? reminder.lastDoneAt,
      updatedAt: now,
    });
  }

  // As for plants: a delete still waiting to push must not be undone by the pull.
  const deleting = queuedDeletes(state.outbox, 'reminder.delete');
  for (const dto of byServerId.values()) {
    if (!deleting.has(dto.id)) out.push(reminderFromServer(dto, plant.id, now));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * What one sync round learned, for store/applySync.js to rebase onto whatever
 * the state has become since the round started.
 *
 * @typedef {object} SyncRound
 * @property {object} base    the state the round started from
 * @property {object} pushed  `base` after the drain: new server ids, retired and
 *                            re-queued entries, rooms dropped for the plan limit
 * @property {{ plants: object[], rooms: object[] } | null} remote
 *                            the pull, or null when the push stopped or the
 *                            pull failed
 * @property {string} now
 */

/**
 * Push, then pull. Returns what the round learned, not a document to commit:
 * the user may have changed things while it was awaiting the network, and only
 * the reducer sees that. Null when nothing was learned at all, so the provider
 * can skip a dispatch.
 *
 * Push progress survives a failed pull — the server ids it earned are what stop
 * the next round from creating the same rows again. The app being killed in
 * the ~400 ms before the debounced save can still lose them; that window is
 * accepted.
 *
 * Never throws: a sync failing is a normal condition, not an error the UI
 * should learn about.
 *
 * @returns {Promise<SyncRound | null>}
 */
export async function syncGarden(state, api = defaultApi, now = new Date().toISOString()) {
  try {
    const pushed = await drainOutbox(state, api);
    let remote = null;
    // A stopped drain means the connection went away mid-push, or the queue is
    // over budget: either way the pull waits, but the ids already earned are
    // still reported.
    if (!pushed.stopped) {
      try {
        const [rooms, plants] = await Promise.all([api.listRooms(), api.getGarden()]);
        remote = { plants: plants ?? [], rooms: rooms ?? [] };
      } catch (e) {
        console.warn('[sync] pull failed; keeping pushed changes:', e?.message ?? e);
      }
    }
    if (pushed.state === state && remote === null) return null;
    return { base: state, pushed: pushed.state, remote, now };
  } catch (e) {
    // drainOutbox catches per entry, so this is a programming error, not the network.
    console.warn('[sync] gave up this round:', e?.message ?? e);
    return null;
  }
}
