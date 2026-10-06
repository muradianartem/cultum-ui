// The garden store: one provider above the router holding every plant, room
// and reminder in the app.
//
// It exists because routing/Route.js unmounts a screen the moment you navigate
// away — anything a screen holds in useState is gone by the time you come back.
// Mounting this above <Router> gives the domain a life independent of whatever
// happens to be on screen.
//
// The server is the only source of truth. Every change is a request, and only
// its response lands in the store: an action resolves once the server has
// answered, and rejects (with the api/client.js ApiError) when it didn't —
// there is no offline queue to fall back on. The garden itself is loaded with
// GET /users/me/rooms + GET /users/me/plants on launch and on every return to
// the foreground; screens see a loader until the first one answers.
//
// The copy on disk (store/persist.js) is a mirror of the last answer, kept for
// the local notifications, which this app schedules itself and must be able to
// rebuild without a connection.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { usePrefs } from '../prefs';
import { ensurePermission, rescheduleAll } from '../notifications';
import * as gardenApi from '../api/garden';
import * as roomsApi from '../api/rooms';
import { showError } from '../lib/showError';
import {
  DEFAULT_TIME_OF_DAY,
  actionMeta,
  emptyState,
  iconForRoomName,
  isoDate,
  livePlants,
  occupiedRooms,
  plantById,
  plantBySpecies,
  plantsInRoom,
  remindersForPlant,
  roomById,
  sortedRooms,
} from './model';
import { importPhoto, reconcile, sweep } from './media';
import { createSaver, loadState } from './persist';
import { reducer } from './reducer';
import { nextTaskForPlant, plantTasks, snoozedTasks, todayTasks, upcomingTasks } from './schedule';
import { mediaUrl } from '../api/mapPlant';


const GardenContext = createContext(null);

/** Derived views are recomputed against a clock that ticks slowly; a due-date
 *  boundary is minutes-granular at worst, and re-rendering every second to
 *  chase it would cost more than it buys. */
const CLOCK_TICK_MS = 5 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 400;
const RESCHEDULE_DEBOUNCE_MS = 1500;
const MEDIA_DEBOUNCE_MS = 1200;

/** How many times a load re-reads a garden that changed under it. */
const LOAD_ATTEMPTS = 3;

/** "2026-09-21" from local fields — changes exactly at local midnight. */
const localDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const defaultApi = { ...gardenApi, ...roomsApi };

/** What an action rejects with when there is no server to ask. */
const noServer = () =>
  Object.assign(new Error('Not connected to the Cultum server'), { code: 'offline', status: 0 });

/** The reminder fields ReminderUpdate accepts; the rest are device-only. */
const SERVER_REMINDER_FIELDS = ['intervalDays', 'timeOfDay', 'enabled'];

/**
 * @param {object}  [initialState]  skip loading and start from this document
 *                                  (tests); mutations still go to `api`
 * @param {Date}    [clock]         freeze "now"; injectable for deterministic
 *                                  tests, the same seam the reminder sheets
 *                                  expose as `today`
 * @param {object}  [api]           the garden + rooms endpoints; a test seam
 */
export function GardenProvider({ children, initialState = null, clock = null, api = defaultApi }) {
  // Optional on purpose: tests mount the garden without a session. With one,
  // only a real signed-in session talks to the server — a dev-bypass session's
  // fake tokens would 401, and apiFetch answers a 401 by ending the session.
  const auth = useAuth();
  const canTalk = auth ? auth.status === 'signedIn' && !auth.devSession : true;
  const [state, dispatch] = useReducer(
    reducer,
    initialState,
    (init) => (init ? { ...init, status: 'ready', error: null } : emptyState()),
  );
  // The mirror has been read off the disk (or there was nothing to read).
  const [hydrated, setHydrated] = useState(initialState != null);
  const [now, setNow] = useState(() => clock ?? new Date());
  // Bumped each time the app comes to the foreground, to refill the
  // notification window (see the reschedule effect).
  const [resumeCount, setResumeCount] = useState(0);

  const saver = useRef(null);
  if (!saver.current) saver.current = createSaver(SAVE_DEBOUNCE_MS);

  // Device preferences, read through a ref rather than closed over: the action
  // object below is memoized, and depending on prefs directly would rebuild
  // every bound action — and re-render every screen holding one — each time any
  // preference changed.
  const prefs = usePrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // The latest state, for callbacks that run outside a render and would
  // otherwise close over a stale snapshot.
  const latest = useRef(state);
  latest.current = state;
  const apiRef = useRef(api);
  apiRef.current = api;
  const canTalkRef = useRef(canTalk);
  canTalkRef.current = canTalk;

  // --- hydrate the mirror -------------------------------------------------
  // Read for the device-only fields and the notification schedule, never
  // shown: the status stays 'loading' until the server answers.
  useEffect(() => {
    if (initialState != null) return undefined;
    let alive = true;
    loadState().then((loaded) => {
      if (!alive) return;
      dispatch({ type: 'state/replace', state: { ...loaded, status: latest.current.status } });
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [initialState]);

  // --- persist the mirror -------------------------------------------------
  // Only a garden the server has answered for: a mirror must never be
  // overwritten by the empty lists of a load still in flight.
  useEffect(() => {
    if (hydrated && state.status === 'ready') saver.current.queue(state);
  }, [state, hydrated]);

  // A pending write must not be lost because the tree went away — flush it on
  // the way out rather than leaving a timer holding the last change.
  useEffect(() => {
    const flush = saver.current.flush;
    return () => flush();
  }, []);

  // The greeting's name comes off the Google ID token at sign-in; mirror it
  // into the document so screens have one place to read it.
  useEffect(() => {
    const name = auth?.profileName ?? null;
    // Only once auth has actually settled. Both providers hydrate from disk
    // asynchronously and independently, so the garden can be hydrated while
    // `profileName` is still null simply because loadTokens has not resolved —
    // and without this guard the mirror would take that null as an edit and
    // wipe the stored name, then write it straight back a moment later.
    //
    // Null-tolerant beyond that window on purpose: clearing the name has to
    // propagate too. It cannot ping-pong, because auth is the only writer — the
    // Edit profile sheet goes through auth.updateProfileName().
    if (hydrated && auth?.status === 'signedIn' && name !== state.profileName) {
      dispatch({ type: 'profile/name', name });
    }
  }, [hydrated, auth?.status, auth?.profileName, state.profileName]);

  // --- talking to the server ---------------------------------------------
  //
  // A load and a change can overlap: the app comes back to the foreground while
  // a plant is being added, say. A GET that started before the POST landed
  // would then replace the garden with a list that lacks the new plant. So every
  // change bumps `changes` when it starts and when it ends, and a load whose
  // window saw either re-reads rather than committing what it got.
  const changes = useRef(0);
  const inFlight = useRef(0);
  const loading = useRef(null);

  const at = useCallback(() => clock ?? new Date(), [clock]);

  const mutate = useCallback(async (fn) => {
    if (!canTalkRef.current) throw noServer();
    inFlight.current += 1;
    changes.current += 1;
    try {
      return await fn(apiRef.current);
    } finally {
      inFlight.current -= 1;
      changes.current += 1;
    }
  }, []);

  /**
   * GET the whole garden and make it the store. Resolves true when it did.
   * Never rejects: a failed first load becomes the 'error' status, and a failed
   * refresh keeps what the server said last.
   */
  const refresh = useCallback(() => {
    if (!canTalkRef.current) return Promise.resolve(false);
    if (loading.current) return loading.current;
    const run = (async () => {
      try {
        for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt += 1) {
          const started = changes.current;
          const [rooms, plants] = await Promise.all([
            apiRef.current.listRooms(),
            apiRef.current.getGarden(),
          ]);
          const clean = changes.current === started && inFlight.current === 0;
          // A garden with nothing on screen yet has nothing a stale answer
          // could undo, so the last attempt commits whatever it has.
          if (clean || (attempt === LOAD_ATTEMPTS && latest.current.status !== 'ready')) {
            dispatch({ type: 'garden/loaded', rooms: rooms ?? [], plants: plants ?? [], now: at().toISOString() });
            return true;
          }
        }
        // Changes kept landing; each one already put its own response in.
        return false;
      } catch (e) {
        console.warn('[garden] could not load the garden:', e?.message ?? e);
        dispatch({ type: 'garden/error', error: e });
        return false;
      } finally {
        loading.current = null;
      }
    })();
    loading.current = run;
    return run;
  }, [at]);

  /** The error screen's Retry: back to the loader, then load. */
  const retry = useCallback(() => {
    dispatch({ type: 'garden/loading' });
    return refresh();
  }, [refresh]);

  // First load, once the mirror is in. Without a session that can talk to the
  // server (dev bypass), the mirror is all there is.
  useEffect(() => {
    if (!hydrated || initialState != null) return;
    if (canTalk) refresh();
    else if (latest.current.status !== 'ready') {
      dispatch({ type: 'state/replace', state: { ...latest.current, status: 'ready', error: null } });
    }
  }, [hydrated, canTalk, initialState, refresh]);

  // --- completions awaiting their undo window ----------------------------
  //
  // The backend has no un-complete, so a completion is only sent once its Undo
  // is no longer on offer. Until then it is on screen only.
  const openCompletions = useRef(new Set());

  const sendCompletions = useCallback(
    (entries) =>
      mutate(async (server) => {
        let failure = null;
        const failed = [];
        for (const entry of entries) {
          try {
            const dto = await server.completeReminder(entry.id);
            if (dto) dispatch({ type: 'reminder/upsert', dto, now: at().toISOString() });
          } catch (e) {
            // Deleted meanwhile: there is nothing left to complete.
            if (e?.status === 404) continue;
            failure = e;
            failed.push(entry);
          }
        }
        if (failure) {
          dispatch({ type: 'reminders/restore', entries: failed });
          throw Object.assign(failure, { restored: true });
        }
      }).catch((e) => {
        // Nothing was sent at all (no server to ask): take every one back.
        if (!e?.restored) dispatch({ type: 'reminders/restore', entries });
        showError(e, 'Couldn’t complete the task');
      }),
    [mutate, at],
  );

  // --- images -------------------------------------------------------------
  // Pull every plant's picture down to disk and drop the ones nothing points at
  // any more, so cards draw without a round-trip. Debounced and guarded rather
  // than run per plant, and the pass's own dispatch must not start another.
  const reconciling = useRef(false);
  useEffect(() => {
    if (!hydrated || state.status === 'loading') return undefined;
    const timer = setTimeout(async () => {
      if (reconciling.current) return;
      reconciling.current = true;
      try {
        const { files, keep } = await reconcile(latest.current.plants);
        if (Object.keys(files).length > 0) dispatch({ type: 'plants/images', files });
        sweep(keep);
      } finally {
        reconciling.current = false;
      }
    }, MEDIA_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.plants, state.status, hydrated]);

  // --- notifications ------------------------------------------------------
  //
  // Keyed on what scheduling actually reads, not on the whole document, so a
  // refresh that changed nothing does not tear down and rebuild the OS queue.
  // It includes everything that moves a date (startAt) or changes banner text
  // (titles, room names).
  const scheduleKey = useMemo(
    () =>
      state.reminders
        .map(
          (r) =>
            `${r.id}|${r.enabled ? 1 : 0}|${r.intervalDays}|${r.timeOfDay}|${r.startAt}|${r.lastDoneAt}|${r.snoozedUntil}|${r.title}`,
        )
        .join(';') +
      '#' +
      state.plants.map((p) => `${p.id}|${p.nickname}|${p.roomId}`).join(';') +
      '#' +
      state.rooms.map((r) => `${r.id}|${r.name}`).join(';'),
    [state.reminders, state.plants, state.rooms],
  );

  // The OS queue is a bounded window (notifications/index.js), so it drains as
  // days pass even when nothing is edited. Refill it whenever the app becomes
  // active and whenever the local day turns over; and rebuild when permission
  // changes. All through the same debounce.
  //
  // Never while loading: the lists are then either empty or the mirror, and an
  // empty rebuild would cancel every reminder the user has. A failed first load
  // schedules from the mirror — the last thing the server said.
  const dayKey = localDayKey(now);
  const notificationPermission = prefs.notificationPermission;
  const notificationsEnabled = prefs.notificationsEnabled;
  const schedulable = hydrated && state.status !== 'loading';
  useEffect(() => {
    if (!schedulable) return undefined;
    const timer = setTimeout(
      () => rescheduleAll(latest.current, undefined, { notificationsEnabled }),
      RESCHEDULE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [scheduleKey, schedulable, notificationsEnabled, dayKey, resumeCount, notificationPermission]);

  // --- clock + foreground -------------------------------------------------
  useEffect(() => {
    const tick = clock ? null : setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        // Time passed while we were away: dates, and anything another device
        // changed, are both stale.
        if (!clock) setNow(new Date());
        setResumeCount((n) => n + 1);
        refresh();
      } else {
        // The process may not get another chance: a completion still waiting
        // on its Undo goes now, and so does the mirror.
        for (const token of [...openCompletions.current]) token.drop();
        saver.current.flush();
      }
    });
    return () => {
      if (tick) clearInterval(tick);
      sub.remove();
    };
  }, [refresh, clock]);

  // ------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------
  const actions = useMemo(() => {
    const stamp = () => at().toISOString();
    const commit = (action) => dispatch({ now: stamp(), ...action });
    const reminder = (id) => latest.current.reminders.find((r) => r.id === id) ?? null;

    /** What an undo has to put back, read before the change. */
    const snapshot = (ids) =>
      ids.flatMap((id) => {
        const r = reminder(id);
        return r ? [{ id, lastDoneAt: r.lastDoneAt ?? null, snoozedUntil: r.snoozedUntil ?? null }] : [];
      });

    /**
     * The token behind the snackbar's Undo: `undo` puts the snapshot back,
     * `drop` (the offer lapsing) runs `onDrop`. Exactly one of them acts.
     *
     * @returns {{count: number, undo: () => void, drop: () => void} | null}
     *          null when the change touched nothing
     */
    const undoable = (entries, onDrop = null) => {
      if (entries.length === 0) return null;
      let spent = false;
      const token = {
        count: entries.length,
        undo() {
          if (spent) return;
          spent = true;
          openCompletions.current.delete(token);
          commit({ type: 'reminders/restore', entries });
        },
        drop() {
          if (spent) return;
          spent = true;
          openCompletions.current.delete(token);
          onDrop?.();
        },
      };
      if (onDrop) openCompletions.current.add(token);
      return token;
    };

    /** Create a reminder on a plant the server has, and store the answer. */
    const createReminder = async (server, plantId, row) => {
      const meta = actionMeta(row.action);
      const dto = await server.createReminder(plantId, {
        type: meta.serverType,
        intervalDays: Number(row.intervalDays ?? meta.defaultIntervalDays),
        timeOfDay: row.timeOfDay ?? prefsRef.current.reminderTime ?? DEFAULT_TIME_OF_DAY,
        enabled: row.enabled !== false,
      });
      commit({
        type: 'reminder/upsert',
        dto,
        local: {
          action: meta.key,
          title: String(row.title ?? meta.label).trim() || meta.label,
          startAt: row.startAt ?? stamp(),
          lastDoneAt: row.lastDoneAt ?? null,
        },
      });
      return dto.id;
    };

    return {
      /**
       * Commit the add-a-plant flow: POST the plant, then each reminder the
       * flow enabled (`{ action, title, intervalDays, startAt?, lastDoneAt? }`).
       *
       * Resolves with the plant's id. Rejects when the plant could not be
       * created — nothing was saved. When the plant was created but a reminder
       * was not, it rejects with that error carrying `plantId`, so the caller
       * can still go on to the plant it saved.
       *
       * A row with a `startAt` (a custom reminder's chosen day) first comes due
       * on that day; one with a `lastDoneAt` (the "Last watering" the user
       * picked) is next due a full interval after it; the rest count as just
       * done, so a 7-day watering is next due in 7 days. An unparsable date
       * counts as absent.
       */
      addPlant: ({ speciesKey, nickname, roomId = null, care = null, heroUri = null, reminders = [] }) =>
        mutate(async (server) => {
          const when = stamp();
          const dto = await server.addPlant({
            speciesKey,
            nickname: String(nickname ?? '').trim(),
            roomId,
            acquiredAt: isoDate(at()),
          });
          commit({ type: 'plant/upsert', dto, local: { care, heroUri } });

          const valid = (iso) => (iso && !Number.isNaN(Date.parse(iso)) ? iso : null);
          let failure = null;
          for (const r of reminders) {
            const start = valid(r.startAt);
            try {
              await createReminder(server, dto.id, {
                ...r,
                startAt: start ?? when,
                lastDoneAt: start ? null : valid(r.lastDoneAt) ?? when,
              });
            } catch (e) {
              failure = failure ?? e;
            }
          }
          // The first plant is the first moment a reminder can matter, and the
          // only honest moment to ask.
          if (reminders.length > 0) ensurePermission();
          if (failure) throw Object.assign(failure, { plantId: dto.id });
          return dto.id;
        }),

      renamePlant: (id, nickname) =>
        mutate(async (server) => {
          const dto = await server.updatePlant(id, { nickname: String(nickname).trim() });
          commit({ type: 'plant/upsert', dto });
        }),

      movePlant: (id, roomId) =>
        mutate(async (server) => {
          const dto = await server.updatePlant(id, { roomId: roomId ?? null });
          commit({ type: 'plant/upsert', dto });
        }),

      /** Delete a plant; the server takes its reminders with it. */
      deletePlant: (id) =>
        mutate(async (server) => {
          await server.removePlant(id);
          commit({ type: 'plant/remove', id });
        }),

      // The catalog's own `image_url` is root-relative; absolutise it here, or
      // the reducer's heroUri fallback stores a path <Image> cannot load.
      setPlantCare: (id, care) =>
        commit({
          type: 'plant/care',
          id,
          care: care ? { ...care, image_url: mediaUrl(care.image_url) } : care,
        }),

      /**
       * Set a plant's own photo — device-only, the server has nowhere to keep
       * it.
       *
       * The camera and the picker both hand back a URI in the OS cache, which
       * the system may reclaim at any point — so the file is copied into the
       * app's storage first and the plant records the copy. The original URI is
       * kept too, as the thing to show for the instant before the copy lands.
       */
      async setPlantPhoto(id, uri) {
        commit({ type: 'plant/photo', id, uri });
        const file = await importPhoto(uri);
        if (file) commit({ type: 'plant/photo', id, uri, file });
        return file;
      },

      /**
       * Create a room at the end of the list and resolve with its id, so a
       * caller can select it. The icon follows the name until the backend lets
       * a user pick one.
       */
      addRoom: (name) =>
        mutate(async (server) => {
          const trimmed = String(name ?? '').trim();
          const sortOrder = latest.current.rooms.reduce(
            (max, r) => Math.max(max, (r.sortOrder ?? 0) + 1),
            0,
          );
          const dto = await server.createRoom({ name: trimmed, icon: iconForRoomName(trimmed), sortOrder });
          commit({ type: 'room/upsert', dto });
          return dto.id;
        }),

      renameRoom: (id, name) =>
        mutate(async (server) => {
          const dto = await server.updateRoom(id, { name: String(name).trim() });
          commit({ type: 'room/upsert', dto });
        }),

      /** Delete a room; the server leaves its plants without a room. */
      deleteRoom: (id) =>
        mutate(async (server) => {
          await server.deleteRoom(id);
          commit({ type: 'room/remove', id });
        }),

      /**
       * "Move and delete room": every plant goes to `toRoomId` first, then the
       * room goes, so the server never sees those plants roomless in between.
       * A failed move stops before the delete.
       */
      deleteRoomMovingPlants: (id, toRoomId) =>
        mutate(async (server) => {
          const moving = latest.current.plants.filter((p) => p.roomId === id);
          for (const plant of moving) {
            const dto = await server.updatePlant(plant.id, { roomId: toRoomId ?? null });
            commit({ type: 'plant/upsert', dto });
          }
          await server.deleteRoom(id);
          commit({ type: 'room/remove', id });
        }),

      /** Resolves with the new reminder's id. */
      addReminder: (plantId, { action = 'custom', title, intervalDays, startAt, timeOfDay }) =>
        mutate(async (server) => {
          const id = await createReminder(server, plantId, { action, title, intervalDays, startAt, timeOfDay });
          ensurePermission();
          return id;
        }),

      /**
       * Change a reminder. The fields the server keeps (interval, time of day,
       * enabled) go to PATCH /reminders/{id}; the rest (title, start day, a
       * back-dated completion) are device-only and are written straight away.
       */
      updateReminder: async (id, patch) => {
        const server = {};
        const local = {};
        for (const [key, value] of Object.entries(patch ?? {})) {
          (SERVER_REMINDER_FIELDS.includes(key) ? server : local)[key] = value;
        }
        if (Object.keys(server).length === 0) {
          commit({ type: 'reminder/local', id, patch: local });
          return;
        }
        await mutate(async (s) => {
          const dto = await s.updateReminder(id, server);
          commit({ type: 'reminder/upsert', dto, local });
        });
      },

      toggleReminder: (id, enabled) =>
        mutate(async (server) => {
          const dto = await server.updateReminder(id, { enabled });
          commit({ type: 'reminder/upsert', dto });
        }),

      deleteReminder: (id) =>
        mutate(async (server) => {
          await server.deleteReminder(id);
          commit({ type: 'reminder/remove', id });
        }),

      /**
       * Mark a reminder done. Shown at once; sent when the returned token's
       * Undo lapses (`drop`), never if it is taken (`undo`).
       *
       * @returns an undo token for the snackbar, or null if there was no row.
       */
      completeReminder(id) {
        const entries = snapshot([id]);
        commit({ type: 'reminder/complete', id });
        return undoable(entries, () => sendCompletions(entries));
      },

      /** Complete several at once ("Complete All" on the Today screen). */
      completeReminders(ids) {
        const entries = snapshot(ids);
        const doneAt = stamp();
        for (const id of ids) commit({ type: 'reminder/complete', id, at: doneAt });
        return undoable(entries, () => sendCompletions(entries));
      },

      /**
       * Push one occurrence out by `ms`, leaving the cadence alone. A falsy
       * `ms` clears the snooze rather than snoozing to this instant — that is
       * what picking "None" on the snooze wheel means. Device-only: the server
       * has no column for it.
       */
      snoozeReminder(id, ms) {
        const entries = snapshot([id]);
        const until = ms > 0 ? new Date(at().getTime() + ms).toISOString() : null;
        commit({ type: 'reminder/snooze', id, until });
        return undoable(entries);
      },

      /**
       * Move every reminder to a new time of day (Settings → Notifications):
       * one PATCH per reminder that changes. Every one is attempted; the first
       * failure is what it rejects with.
       *
       * The name is deliberately blunt: the setting reads "Reminders arrive at
       * this time", and nothing in the UI sets a reminder's time individually,
       * so there is no user intent to preserve. The day a per-reminder time
       * picker ships, this has to learn to leave customised ones alone.
       */
      retimeAllReminders: (timeOfDay) =>
        mutate(async (server) => {
          const target = String(timeOfDay);
          const changed = latest.current.reminders.filter((r) => r.timeOfDay !== target);
          let failure = null;
          for (const r of changed) {
            try {
              const dto = await server.updateReminder(r.id, { timeOfDay: target });
              commit({ type: 'reminder/upsert', dto });
            } catch (e) {
              failure = failure ?? e;
            }
          }
          if (failure) throw failure;
        }),

      // No setProfileName: auth owns the name (auth.updateProfileName) and the
      // effect above mirrors it here. A second public writer is how that
      // invariant gets broken.
      refresh,
      retry,
    };
  }, [mutate, refresh, retry, sendCompletions, at]);

  // ------------------------------------------------------------------------
  // Derived views
  // ------------------------------------------------------------------------
  const value = useMemo(() => {
    const plants = livePlants(state);
    return {
      // True once the server has answered; screens are only shown after that.
      ready: state.status === 'ready',
      status: state.status,
      error: state.error,
      state,
      now,
      plants,
      rooms: sortedRooms(state),
      reminders: state.reminders,
      profileName: state.profileName,

      // selectors — bound so screens never have to pass `state` around
      getPlant: (id) => plantById(state, id),
      getRoom: (id) => roomById(state, id),
      getPlantBySpecies: (key) => plantBySpecies(state, key),
      plantsInRoom: (roomId) => plantsInRoom(state, roomId),
      remindersFor: (plantId) => remindersForPlant(state, plantId),
      occupiedRooms: () => occupiedRooms(state),
      tasksForPlant: (plantId) => plantTasks(state, plantId, now),
      nextDueForPlant: (plantId) => nextTaskForPlant(state, plantId, now),

      todaysTasks: todayTasks(state, now),
      upcoming: upcomingTasks(state, now),
      snoozed: snoozedTasks(state, now),

      ...actions,
    };
  }, [state, now, actions]);

  return <GardenContext.Provider value={value}>{children}</GardenContext.Provider>;
}

export function useGarden() {
  const ctx = useContext(GardenContext);
  if (!ctx) throw new Error('useGarden must be used inside a <GardenProvider>.');
  return ctx;
}
