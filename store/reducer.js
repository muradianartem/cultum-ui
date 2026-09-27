// The garden reducer: how a server response, or a device-only edit, lands in
// the document.
//
// There is no queue and nothing "pending" here. Every change the server keeps
// is a request made by store/GardenProvider.js; only its *response* is
// dispatched, as an upsert or a removal. What is left are the fields the server
// has no column for (store/fromServer.js lists them), which are written
// directly because there is nowhere else to write them.
//
// Pure: no clock of its own (actions carry `now`), no I/O.

import { gardenFromServer, plantFromServer, reminderFromServer, roomFromServer } from './fromServer';

const mapById = (list, id, fn) => list.map((item) => (item.id === id ? fn(item) : item));

/** Replace the entity with the same id, or append it. */
const upsert = (list, entity) =>
  list.some((x) => x.id === entity.id) ? mapById(list, entity.id, () => entity) : [...list, entity];

const findById = (list, id) => list.find((x) => x.id === id) ?? null;

export function reducer(state, action) {
  const now = action.now ?? new Date().toISOString();

  switch (action.type) {
    // --- whole-document replacement (hydrate, tests) ---
    case 'state/replace':
      return action.state;

    // --- loading the garden --------------------------------------------------

    /** GET /users/me/rooms + GET /users/me/plants came back: the server's word. */
    case 'garden/loaded':
      return {
        ...state,
        ...gardenFromServer(action.rooms, action.plants, state, now),
        status: 'ready',
        error: null,
      };

    /**
     * The load failed. Only the *first* load turns into an error screen; once
     * the server has answered, a failed refresh keeps what it said last.
     */
    case 'garden/error':
      if (state.status === 'ready') return state;
      return { ...state, status: 'error', error: action.error ?? null };

    case 'garden/loading':
      if (state.status === 'loading') return state;
      return { ...state, status: state.status === 'ready' ? 'ready' : 'loading', error: null };

    case 'profile/name':
      return { ...state, profileName: action.name ?? null };

    // --- server responses ---------------------------------------------------

    case 'room/upsert':
      return {
        ...state,
        rooms: upsert(state.rooms, roomFromServer(action.dto, findById(state.rooms, action.dto.id))),
      };

    /** The server leaves a deleted room's plants roomless; so does this. */
    case 'room/remove':
      if (!findById(state.rooms, action.id)) return state;
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        plants: state.plants.map((p) => (p.roomId === action.id ? { ...p, roomId: null } : p)),
      };

    /**
     * A plant's own fields; its reminders are upserted on their own. `local`
     * fills what a create's response may lack (the catalog's care and hero
     * image the add flow already had).
     */
    case 'plant/upsert':
      return {
        ...state,
        plants: upsert(
          state.plants,
          plantFromServer(action.dto, findById(state.plants, action.dto.id) ?? action.local ?? null),
        ),
      };

    /** The server cascades a plant's reminders; so does this. */
    case 'plant/remove':
      if (!findById(state.plants, action.id)) return state;
      return {
        ...state,
        plants: state.plants.filter((p) => p.id !== action.id),
        reminders: state.reminders.filter((r) => r.plantId !== action.id),
      };

    /**
     * A ReminderOut. `local` carries the device-only fields this device just
     * decided (a custom title, a start day) — the response cannot.
     */
    case 'reminder/upsert':
      return {
        ...state,
        reminders: upsert(
          state.reminders,
          reminderFromServer(action.dto, findById(state.reminders, action.dto.id), action.local ?? {}, now),
        ),
      };

    case 'reminder/remove':
      if (!findById(state.reminders, action.id)) return state;
      return { ...state, reminders: state.reminders.filter((r) => r.id !== action.id) };

    // --- device-only fields -------------------------------------------------

    /** Title, start day, a back-dated completion: nothing the server stores. */
    case 'reminder/local':
      if (!findById(state.reminders, action.id)) return state;
      return {
        ...state,
        reminders: mapById(state.reminders, action.id, (r) => ({ ...r, ...action.patch })),
      };

    /**
     * Mark a reminder done on screen while its Undo is on offer. The server
     * hears about it only once the offer lapses (GardenProvider#completeReminder):
     * the backend has no un-complete.
     */
    case 'reminder/complete':
      if (!findById(state.reminders, action.id)) return state;
      return {
        ...state,
        reminders: mapById(state.reminders, action.id, (r) => ({
          ...r,
          lastDoneAt: action.at ?? now,
          snoozedUntil: null,
        })),
      };

    /**
     * Push one occurrence later without touching the cadence — the plant is
     * still on its schedule, this instance just isn't happening now.
     */
    case 'reminder/snooze':
      if (!findById(state.reminders, action.id)) return state;
      return {
        ...state,
        reminders: mapById(state.reminders, action.id, (r) => ({ ...r, snoozedUntil: action.until })),
      };

    /**
     * Put back what a completion or a snooze overwrote — the Undo on the
     * snackbar, or a completion the server refused. `entries` are
     * `{ id, lastDoneAt, snoozedUntil }`, captured before the change.
     */
    case 'reminders/restore': {
      const prior = new Map((action.entries ?? []).map((e) => [e.id, e]));
      if (prior.size === 0) return state;
      return {
        ...state,
        reminders: state.reminders.map((r) => {
          const was = prior.get(r.id);
          return was
            ? { ...r, lastDoneAt: was.lastDoneAt ?? null, snoozedUntil: was.snoozedUntil ?? null }
            : r;
        }),
      };
    }

    /** Refresh the cached SpeciesDetail behind a plant (a re-fetch). */
    case 'plant/care':
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) => ({
          ...p,
          care: action.care,
          heroUri: p.heroUri ?? action.care?.image_url ?? null,
        })),
      };

    case 'plant/photo':
      return {
        ...state,
        plants: mapById(state.plants, action.id, (p) => ({
          ...p,
          photoUri: action.uri,
          imageFile: action.file ?? null,
        })),
      };

    /**
     * Record where plants' pictures landed on disk (store/media.js#reconcile).
     * Batched because one pass usually resolves several at once, and a dispatch
     * per image would re-run the pass that produced them.
     */
    case 'plants/images': {
      const files = action.files ?? {};
      if (Object.keys(files).length === 0) return state;
      return {
        ...state,
        plants: state.plants.map((p) => (files[p.id] ? { ...p, imageFile: files[p.id] } : p)),
      };
    }

    default:
      return state;
  }
}
