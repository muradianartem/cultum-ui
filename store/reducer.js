// The garden reducer: every mutation the app can make, as a pure function.
//
// Three things happen on every write, and they happen here rather than in the
// screens so they cannot be forgotten:
//   1. the entity's `updatedAt` is stamped,
//   2. fields the backend can't accept are marked dirty, so a sync pull won't
//      clobber them (see the PATCH gap noted in store/sync.js),
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

/** Mark a locally-changed field the server has no endpoint to receive. */
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
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) =>
          stamp(markDirty({ ...p, nickname: String(action.nickname).trim() }, 'nickname'), now),
        ),
      };

    case 'plant/move':
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) =>
          stamp(markDirty({ ...p, roomId: action.roomId }, 'roomId'), now),
        ),
      };

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
        plants: mapById(state.plants, action.id, (p) => stamp({ ...p, photoUri: action.uri }, now)),
      };

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

    // --- rooms (local-only: the server stores a plant's room as a string) ---

    case 'room/add':
      return { ...state, rooms: [...state.rooms, action.room ?? makeRoom(action.name)] };

    case 'room/rename':
      return {
        ...state,
        rooms: mapById(state.rooms, action.id, (r) => ({
          ...r,
          name: String(action.name).trim(),
        })),
        // The room's name is what the server knows as each plant's location, so
        // renaming one makes every plant in it locally authoritative.
        plants: state.plants.map((p) =>
          p.roomId === action.id ? stamp(markDirty(p, 'roomId'), now) : p,
        ),
      };

    /** Remove a room; its plants become roomless rather than disappearing. */
    case 'room/delete':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        plants: state.plants.map((p) =>
          p.roomId === action.id ? stamp(markDirty({ ...p, roomId: null }, 'roomId'), now) : p,
        ),
      };

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
