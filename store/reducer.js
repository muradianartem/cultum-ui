// The garden reducer: every mutation the app can make, as a pure function.
//
// Three things happen on every write, and they happen here rather than in the
// screens so they cannot be forgotten:
//   1. the entity's `updatedAt` is stamped,
//   2. fields the backend has no column for are marked dirty, so a sync pull
//      won't clobber them (today only a plant's `archived`),
//   3. an outbox entry is queued so the change reaches the server whenever the
//      device next has a connection.
//
// Pure: no clock of its own (actions carry `now`), no I/O. store/persist.js
// writes the result, store/GardenProvider.js dispatches into it.

import { makeReminder, makeRoom } from './model';

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

/**
 * Queue one intent to push.
 *
 * Entries are collapsed per (op, localId): the drain reads the *current* state
 * to build its payload, so two edits to the same reminder are one push, and
 * re-queueing only matters for ordering. `serverId` is carried on the entry
 * itself because a delete has to survive the entity leaving state.
 */
export function enqueue(outbox, op, localId, serverId = null) {
  const rest = outbox.filter((e) => !(e.op === op && e.localId === localId));
  return [...rest, { op, localId, serverId, attempts: 0 }];
}

const dropAll = (outbox, localId) => outbox.filter((e) => e.localId !== localId);

/**
 * Queue a deletion. Something the server has never seen is simply forgotten,
 * along with whatever was queued for it — pushing a create and then a delete
 * for the same row would be two round trips to reach where we already are.
 */
function enqueueDelete(outbox, op, localId, serverId) {
  const cleared = dropAll(outbox, localId);
  return serverId ? [...cleared, { op, localId, serverId, attempts: 0 }] : cleared;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stamp = (entity, now) => ({ ...entity, updatedAt: now });

const mapById = (list, id, fn) => list.map((item) => (item.id === id ? fn(item) : item));

/**
 * A rename or a move. Queued only for a plant the server already has; one still
 * waiting on its create carries the new values in that create.
 */
function updatePlant(state, id, patch, now) {
  const plant = state.plants.find((p) => p.id === id);
  if (!plant) return state;
  return {
    ...state,
    plants: mapById(state.plants, id, (p) => stamp({ ...p, ...patch }, now)),
    outbox: plant.serverId
      ? enqueue(state.outbox, 'plant.update', plant.id, plant.serverId)
      : state.outbox,
  };
}

function deleteRoom(state, id, now) {
  const room = state.rooms.find((r) => r.id === id);
  if (!room) return state;
  return {
    ...state,
    rooms: state.rooms.filter((r) => r.id !== id),
    plants: state.plants.map((p) => (p.roomId === id ? stamp({ ...p, roomId: null }, now) : p)),
    outbox: enqueueDelete(state.outbox, 'room.delete', room.id, room.serverId),
  };
}

/** Mark a locally-changed field the server has no column to receive. */
const markDirty = (plant, field) => ({
  ...plant,
  dirty: { ...plant.dirty, [field]: true },
});

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducer(state, action) {
  const now = action.now ?? new Date().toISOString();

  switch (action.type) {
    // --- whole-document replacement (hydrate, sync merge, sign-out reset) ---
    case 'state/replace':
      return action.state;

    case 'profile/name':
      return { ...state, profileName: action.name ?? null };

    // --- plants ------------------------------------------------------------

    /**
     * Add a plant and, in the same commit, the reminders chosen for it in the
     * add-a-plant flow. One action so the two can never be half-written — and
     * so the outbox orders the plant's create ahead of its reminders'.
     */
    case 'plant/add': {
      const plant = action.plant;
      const reminders = action.reminders ?? [];
      let outbox = enqueue(state.outbox, 'plant.create', plant.id);
      for (const r of reminders) outbox = enqueue(outbox, 'reminder.create', r.id);
      return {
        ...state,
        plants: [...state.plants, plant],
        reminders: [...state.reminders, ...reminders],
        outbox,
      };
    }

    case 'plant/rename':
      return updatePlant(state, action.id, { nickname: String(action.nickname).trim() }, now);

    case 'plant/move':
      return updatePlant(state, action.id, { roomId: action.roomId ?? null }, now);

    case 'plant/archive':
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) =>
          stamp(markDirty({ ...p, archived: action.archived !== false }, 'archived'), now),
        ),
      };

    /** Refresh the cached SpeciesDetail behind a plant (a sync or a re-fetch). */
    case 'plant/care':
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) =>
          stamp(
            { ...p, care: action.care, heroUri: p.heroUri ?? action.care?.image_url ?? null },
            now,
          ),
        ),
      };

    case 'plant/photo':
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) =>
          stamp({ ...p, photoUri: action.uri, imageFile: action.file ?? null }, now),
        ),
      };

    /**
     * Record where plants' pictures landed on disk (store/media.js#reconcile).
     *
     * Not a user edit: nothing is stamped and nothing is queued. The bytes are
     * a local cache of something the server already knows about, so touching
     * `updatedAt` here would make every launch look like a change worth
     * pushing. Batched because one pass usually resolves several at once, and a
     * dispatch per image would re-run the pass that produced them.
     */
    case 'plants/images': {
      const files = action.files ?? {};
      if (Object.keys(files).length === 0) return state;
      return {
        ...state,
        plants: state.plants.map((p) => (files[p.id] ? { ...p, imageFile: files[p.id] } : p)),
      };
    }

    /** Delete a plant and everything hanging off it. */
    case 'plant/delete': {
      const plant = state.plants.find((p) => p.id === action.id);
      if (!plant) return state;
      const gone = state.reminders.filter((r) => r.plantId === action.id);
      let outbox = enqueueDelete(state.outbox, 'plant.delete', plant.id, plant.serverId);
      // The server cascades a plant's reminders; only local bookkeeping is left.
      for (const r of gone) outbox = dropAll(outbox, r.id);
      return {
        ...state,
        plants: state.plants.filter((p) => p.id !== action.id),
        reminders: state.reminders.filter((r) => r.plantId !== action.id),
        outbox,
      };
    }

    // --- rooms --------------------------------------------------------------

    /** Append a room at the end of the server's ordering and queue its create. */
    case 'room/add': {
      const room = action.room ?? makeRoom({ name: action.name, now: new Date(now) });
      const sortOrder = state.rooms.reduce((max, r) => Math.max(max, (r.sortOrder ?? 0) + 1), 0);
      return {
        ...state,
        rooms: [...state.rooms, { ...room, sortOrder }],
        outbox: enqueue(state.outbox, 'room.create', room.id),
      };
    }

    case 'room/rename': {
      const room = state.rooms.find((r) => r.id === action.id);
      if (!room) return state;
      return {
        ...state,
        rooms: mapById(state.rooms, action.id, (r) =>
          stamp({ ...r, name: String(action.name).trim() }, now),
        ),
        outbox: room.serverId
          ? enqueue(state.outbox, 'room.update', room.id, room.serverId)
          : state.outbox, // still un-created: its create will carry the new name
      };
    }

    /**
     * Remove a room; its plants become roomless rather than disappearing. The
     * server does the same to its copy, so the plants need no push of their own.
     */
    case 'room/delete':
      return deleteRoom(state, action.id, now);

    /**
     * "Move and delete room": every plant goes to `toRoomId` first, then the
     * room goes. The moves are queued ahead of the delete, so the server never
     * sees those plants roomless in between.
     */
    case 'room/deleteMoving': {
      if (!state.rooms.some((r) => r.id === action.id)) return state;
      let next = state;
      for (const p of state.plants) {
        if (p.roomId === action.id) next = updatePlant(next, p.id, { roomId: action.toRoomId }, now);
      }
      return deleteRoom(next, action.id, now);
    }

    // --- reminders ---------------------------------------------------------

    case 'reminder/add': {
      const reminder = action.reminder ?? makeReminder(action);
      return {
        ...state,
        reminders: [...state.reminders, reminder],
        outbox: enqueue(state.outbox, 'reminder.create', reminder.id),
      };
    }

    case 'reminder/update': {
      const reminder = state.reminders.find((r) => r.id === action.id);
      if (!reminder) return state;
      return {
        ...state,
        reminders: mapById(state.reminders, action.id, (r) => stamp({ ...r, ...action.patch }, now)),
        outbox: reminder.serverId
          ? enqueue(state.outbox, 'reminder.update', reminder.id, reminder.serverId)
          : state.outbox, // still un-created: its create will carry the new values
      };
    }

    /**
     * Move every reminder to a new time of day — the global "Reminder time" in
     * Settings → Notifications.
     *
     * Returning state *by identity* when nothing changed is load-bearing, not
     * an optimisation: GardenProvider's persist, sync, media and reschedule
     * effects all key off the state object, so a no-op re-save would otherwise
     * cost a disk write, a sync round and a full rebuild of the OS notification
     * queue for a setting the user re-picked without changing.
     *
     * Only reminders the server already knows are queued. One still awaiting
     * its create needs nothing: `pushOne`'s `reminder.create` reads current
     * state at drain time, so it carries the new time by itself.
     *
     * FORWARD HAZARD: this is only safe because nothing in the UI sets a
     * reminder's time individually today, so there is no per-reminder intent to
     * destroy. The day a per-reminder time picker ships, this has to become
     * "rewrite only the ones the user never re-timed" — which needs a
     * `timeOfDayCustom` flag on the reminder and a gap-fill in
     * store/persist.js#migrate.
     */
    case 'reminders/timeOfDay': {
      const timeOfDay = String(action.timeOfDay);
      const changed = state.reminders.filter((r) => r.timeOfDay !== timeOfDay);
      if (changed.length === 0) return state;
      let outbox = state.outbox;
      for (const r of changed) {
        if (r.serverId) outbox = enqueue(outbox, 'reminder.update', r.id, r.serverId);
      }
      return {
        ...state,
        reminders: state.reminders.map((r) =>
          r.timeOfDay === timeOfDay ? r : stamp({ ...r, timeOfDay }, now),
        ),
        outbox,
      };
    }

    /**
     * Mark a reminder done. `lastDoneAt` re-anchors the cadence (store/schedule.js
     * derives the next date from it) and any active snooze is spent.
     *
     * Queued even for a reminder the server has never seen: ReminderCreate has
     * no `last_done_at` field, so a completion made before the first sync would
     * otherwise never reach the server. Ordering saves us — the create is ahead
     * of this in the queue, so by the time it runs there is an id to complete.
     */
    case 'reminder/complete': {
      const reminder = state.reminders.find((r) => r.id === action.id);
      if (!reminder) return state;
      return {
        ...state,
        reminders: mapById(state.reminders, action.id, (r) =>
          stamp({ ...r, lastDoneAt: action.at ?? now, snoozedUntil: null }, now),
        ),
        outbox: enqueue(state.outbox, 'reminder.complete', reminder.id, reminder.serverId),
      };
    }

    /**
     * Push one occurrence later without touching the cadence — the plant is
     * still on its schedule, this instance just isn't happening now.
     */
    case 'reminder/snooze':
      return {
        ...state,
        reminders: mapById(state.reminders, action.id, (r) =>
          stamp({ ...r, snoozedUntil: action.until }, now),
        ),
      };

    /**
     * Put back what a completion or a snooze overwrote — the other half of the
     * Undo on the snackbar.
     *
     * `entries` come from the mutation itself (store/GardenProvider.js snapshots
     * them before dispatching): `{ id, lastDoneAt, snoozedUntil, updatedAt,
     * wasQueued }`. Restoring the captured `updatedAt` rather than stamping
     * `now` makes this an exact inverse.
     *
     * Only entries this mutation queued are dropped from the outbox: `enqueue`
     * collapses per (op, localId), so an offline "complete, complete again,
     * undo" would otherwise discard the first completion, which nobody undid.
     * That is what `wasQueued` records.
     */
    case 'reminders/restore': {
      const prior = new Map((action.entries ?? []).map((e) => [e.id, e]));
      if (prior.size === 0) return state;
      return {
        ...state,
        reminders: state.reminders.map((r) => {
          const was = prior.get(r.id);
          return was
            ? {
              ...r,
              lastDoneAt: was.lastDoneAt ?? null,
              snoozedUntil: was.snoozedUntil ?? null,
              updatedAt: was.updatedAt ?? now,
            }
            : r;
        }),
        outbox: state.outbox.filter(
          (e) => !(e.op === 'reminder.complete' && prior.get(e.localId)?.wasQueued === false),
        ),
      };
    }

    case 'reminder/delete': {
      const reminder = state.reminders.find((r) => r.id === action.id);
      if (!reminder) return state;
      return {
        ...state,
        reminders: state.reminders.filter((r) => r.id !== action.id),
        outbox: enqueueDelete(state.outbox, 'reminder.delete', reminder.id, reminder.serverId),
      };
    }

    default:
      return state;
  }
}
