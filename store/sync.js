// Pushing local changes to the backend and pulling the garden back.
//
// Local-first: every mutation has already been applied and persisted by the
// time this runs. Sync is best-effort catch-up, never a gate — the app is fully
// usable with the radio off, and a failed sync leaves the queue intact for the
// next attempt.
//
// Two shapes of work:
//   1. drain the outbox, in order, translating each queued intent into a call;
//   2. pull GET /users/me/plants and merge it over local state.
//
// The merge has to be careful in one specific way. The backend has no PATCH for
// a user plant, so a rename, a move between rooms or an archive can never be
// pushed — they exist only here. The reducer marks those fields dirty, and the
// merge refuses to overwrite a dirty field. Without that, renaming a plant and
// then syncing would silently undo the rename.

import * as gardenApi from '../api/garden';
import { actionMeta, makeRoom, uid } from './model';
import { enqueue } from './reducer';

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
    timeOfDay: dto.time_of_day ? String(dto.time_of_day).slice(0, 5) : '09:00',
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
    heroUri: dto.image_url ?? dto.care?.image_url ?? null,
    photoUri: null,
    archived: false,
    dirty: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The room for a server-side `location` string, creating one if this device has
 * never seen that name. Matching is case-insensitive so "Kitchen" from another
 * device lands in the same room as the local "kitchen".
 */
function resolveRoom(rooms, location) {
  if (!location) return { rooms, roomId: null };
  const want = location.trim().toLowerCase();
  const found = rooms.find((r) => r.name.trim().toLowerCase() === want);
  if (found) return { rooms, roomId: found.id };
  const room = makeRoom(location);
  return { rooms: [...rooms, room], roomId: room.id };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

// A failure that means "the network isn't there" — stop and keep the queue.
// Anything else is the server rejecting this particular entry, which retrying
// forever would never fix, so it is dropped after being logged.
const isTransient = (e) =>
  e?.code === 'offline' || e?.code === 'network' || e?.code === 'timeout' || e?.status >= 500;

/**
 * Send everything queued, in order.
 *
 * Payloads are read from the *current* state rather than snapshotted at queue
 * time, so a row edited three times before a connection appears is pushed once,
 * with its final values.
 *
 * @returns {{ state: object, stopped: boolean }}
 */
export async function drainOutbox(state, api = gardenApi) {
  let next = state;
  let stopped = false;
  const queue = [...next.outbox];

  for (const entry of queue) {
    try {
      next = await pushOne(next, entry, api);
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
  return { state: next, stopped };
}

async function pushOne(state, entry, api) {
  switch (entry.op) {
    case 'plant.create': {
      const plant = state.plants.find((p) => p.id === entry.localId);
      if (!plant || plant.serverId) return state; // gone, or already pushed
      const dto = await api.addPlant({
        speciesKey: plant.speciesKey,
        nickname: plant.nickname,
        location: state.rooms.find((r) => r.id === plant.roomId)?.name ?? null,
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

/**
 * Fold the server's garden into local state.
 *
 * Rules, in one place:
 *   • a plant is matched by `serverId`; one that has a serverId the server no
 *     longer lists was deleted elsewhere and goes too;
 *   • a plant with no serverId is a pending create and is left alone;
 *   • a remote plant nobody here knows is adopted, along with its reminders and
 *     a room for its `location`;
 *   • server values win, except for fields marked dirty (unpushable local
 *     edits) and fields the server has no column for (`title`, `snoozedUntil`,
 *     `photoUri`, `archived`);
 *   • a reminder with a queued push is left alone — the queue is newer.
 */
export function mergeGarden(state, remote, now = new Date().toISOString()) {
  const remoteById = new Map((remote ?? []).map((dto) => [dto.id, dto]));
  const queued = new Set(state.outbox.map((e) => e.localId));

  let rooms = state.rooms;
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

    const resolved = resolveRoom(rooms, dto.location);
    rooms = resolved.rooms;

    plants.push({
      ...plant,
      speciesKey: dto.species_key ?? plant.speciesKey,
      care: dto.care ?? plant.care,
      heroUri: plant.heroUri ?? dto.image_url ?? dto.care?.image_url ?? null,
      nickname: plant.dirty?.nickname ? plant.nickname : dto.nickname ?? plant.nickname,
      roomId: plant.dirty?.roomId ? plant.roomId : resolved.roomId ?? plant.roomId,
      acquiredAt: dto.acquired_at ?? plant.acquiredAt,
      updatedAt: now,
    });

    reminders.push(...mergeReminders(state, plant, dto.reminders ?? [], queued, now));
  }

  // Whatever is left in the map is new to this device.
  for (const dto of remoteById.values()) {
    const resolved = resolveRoom(rooms, dto.location);
    rooms = resolved.rooms;
    const plant = plantFromServer(dto, resolved.roomId, now);
    plants.push(plant);
    keptPlantIds.add(plant.id);
    for (const r of dto.reminders ?? []) reminders.push(reminderFromServer(r, plant.id, now));
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

  for (const dto of byServerId.values()) out.push(reminderFromServer(dto, plant.id, now));
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Push, then pull. Returns the state to commit, or null when nothing changed
 * so the provider can skip a re-render and a disk write.
 *
 * Never throws: a sync failing is a normal condition, not an error the UI
 * should learn about.
 */
export async function syncGarden(state, api = gardenApi, now = new Date().toISOString()) {
  try {
    const pushed = await drainOutbox(state, api);
    if (pushed.stopped) {
      // The connection went away mid-push. Commit whatever server ids we did
      // collect so the next attempt doesn't re-create those rows.
      return pushed.state === state ? null : pushed.state;
    }
    const remote = await api.getGarden();
    return mergeGarden(pushed.state, remote, now);
  } catch (e) {
    console.warn('[sync] gave up this round:', e?.message ?? e);
    return null;
  }
}
