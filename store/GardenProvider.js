// The garden store: one provider above the router holding every plant, room
// and reminder in the app.
//
// It exists because routing/Route.js unmounts a screen the moment you navigate
// away — anything a screen holds in useState is gone by the time you come back.
// Mounting this above <Router> gives the domain a life independent of whatever
// happens to be on screen.
//
// Responsibilities, in order: hydrate from disk, expose state and bound
// actions, and then react to every change by persisting it, re-scheduling
// notifications and nudging a sync. Screens only ever call the actions.

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
import {
  DEFAULT_TIME_OF_DAY,
  actionMeta,
  emptyState,
  livePlants,
  makePlant,
  makeReminder,
  makeRoom,
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
import { nextTaskForPlant, plantTasks, todayTasks, upcomingTasks } from './schedule';
import { syncGarden } from './sync';
import { mediaUrl } from '../api/mapPlant';

const GardenContext = createContext(null);

/** Derived views are recomputed against a clock that ticks slowly; a due-date
 *  boundary is minutes-granular at worst, and re-rendering every second to
 *  chase it would cost more than it buys. */
const CLOCK_TICK_MS = 5 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 400;
const SYNC_DEBOUNCE_MS = 2000;
const RESCHEDULE_DEBOUNCE_MS = 1500;

/** "2026-09-21" from local fields — changes exactly at local midnight. */
const localDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MEDIA_DEBOUNCE_MS = 1200;

/**
 * @param {object}  [initialState]  skip hydration and start from this document
 * @param {Date}    [clock]         freeze "now"; injectable for deterministic
 *                                  tests, the same seam the reminder sheets
 *                                  expose as `today`
 */
export function GardenProvider({ children, initialState = null, clock = null }) {
  // Optional on purpose: the garden is meaningful without a session (the whole
  // app works signed out of the network), and only sync needs to know.
  const auth = useAuth();
  const status = auth?.status ?? null;
  const devSession = auth?.devSession ?? false;
  const [state, dispatch] = useReducer(reducer, initialState ?? emptyState());
  const [ready, setReady] = useState(initialState != null);
  const [now, setNow] = useState(() => clock ?? new Date());
  // Bumped each time the app comes to the foreground, to refill the
  // notification window (see the reschedule effect).
  const [resumeCount, setResumeCount] = useState(0);

  // An open undo window freezes the outbox: the backend has no un-complete
  // endpoint, so a completion that reaches it can never be taken back. State
  // rather than a ref, so releasing a hold re-runs the sync effect below — and
  // therefore reads the state the undo's own dispatch just produced.
  const [holds, setHolds] = useState(0);
  const holding = useRef(0);
  holding.current = holds;

  const saver = useRef(null);
  if (!saver.current) saver.current = createSaver(SAVE_DEBOUNCE_MS);

  // Device preferences, read through a ref rather than closed over: the action
  // object below is memoized, and depending on prefs directly would rebuild
  // every bound action — and re-render every screen holding one — each time any
  // preference changed.
  const prefs = usePrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // The latest state, for the timers below — they fire outside a render and
  // would otherwise close over a stale snapshot.
  const latest = useRef(state);
  latest.current = state;

  // --- hydrate ------------------------------------------------------------
  useEffect(() => {
    if (initialState != null) return;
    let alive = true;
    loadState().then((loaded) => {
      if (!alive) return;
      dispatch({ type: 'state/replace', state: loaded });
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [initialState]);

  // --- persist ------------------------------------------------------------
  useEffect(() => {
    if (ready) saver.current.queue(state);
  }, [state, ready]);

  // A pending write must not be lost because the tree went away — flush it on
  // the way out rather than leaving a timer holding the last change.
  useEffect(() => {
    const flush = saver.current.flush;
    return () => flush();
  }, []);

  // The greeting's name comes off the Google ID token at sign-in (there is no
  // profile endpoint); mirror it into the document so screens have one place to
  // read it and it survives a relaunch.
  useEffect(() => {
    const name = auth?.profileName ?? null;
    // Only once auth has actually settled. Both providers hydrate from disk
    // asynchronously and independently, so the garden can be `ready` while
    // `profileName` is still null simply because loadTokens has not resolved —
    // and without this guard the mirror would take that null as an edit and
    // wipe the stored name, then write it straight back a moment later.
    //
    // Null-tolerant beyond that window on purpose: clearing the name has to
    // propagate too, or the document keeps a stale one forever. It cannot
    // ping-pong, because auth is the only writer — the Edit profile sheet goes
    // through auth.updateProfileName() precisely so this mirror never races it.
    if (ready && auth?.status === 'signedIn' && name !== state.profileName) {
      dispatch({ type: 'profile/name', name });
    }
  }, [ready, auth?.status, auth?.profileName, state.profileName]);

  // --- sync ---------------------------------------------------------------
  const syncing = useRef(false);
  const runSync = useCallback(async () => {
    // A dev-bypass session has no real credentials — calling the garden
    // endpoints with them would 401, and apiFetch answers a 401 by rotating
    // the session, which would end it.
    if (holding.current > 0 || syncing.current || status !== 'signedIn' || devSession) return;
    syncing.current = true;
    try {
      // Rebased in the reducer, never replaced: the user may have edited, added
      // or deleted things while this awaited the network, and `latest.current`
      // from before the round knows nothing about them.
      const round = await syncGarden(latest.current);
      if (round) dispatch({ type: 'sync/apply', round });
    } finally {
      syncing.current = false;
    }
  }, [status, devSession]);

  /**
   * Freeze the outbox while an undo is on offer, and hand back an idempotent
   * release. A counter rather than a flag: a second snackbar takes its hold
   * before the host dismisses the first and releases, so the count never dips
   * to zero between two completions in a row.
   */
  const holdSync = useCallback(() => {
    setHolds((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setHolds((n) => Math.max(0, n - 1));
    };
  }, []);

  // Keyed on the outbox, not on the whole document: a successful pull replaces
  // plants, reminders and rooms wholesale, so depending on `state` would make
  // every sync trigger the next one, forever. The outbox is the only thing that
  // says there is something new to push, and a pull that changes nothing leaves
  // it identical.
  // A hold cancels the pending timer; releasing one schedules a fresh 2s.
  useEffect(() => {
    if (!ready || holds > 0) return undefined;
    const timer = setTimeout(runSync, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.outbox, ready, holds, runSync]);

  // --- images -------------------------------------------------------------
  // Pull every plant's picture down to disk and drop the ones nothing points at
  // any more. This is what makes a card survive two things it otherwise would
  // not: the radio being off, and a sign-out — which deletes the document, so
  // the next sign-in rebuilds the garden from the server and keeps only what
  // the server can restate.
  //
  // Debounced and guarded rather than run per plant: adding a plant with three
  // reminders is one pass, and the pass's own dispatch must not start another.
  const reconciling = useRef(false);
  useEffect(() => {
    if (!ready) return undefined;
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
  }, [state.plants, ready]);

  // --- notifications ------------------------------------------------------
  //
  // Keyed on what scheduling actually reads, not on the whole document. Two
  // things made `[state]` wrong: every pull stamps `updatedAt` on every plant
  // (store/sync.js#mergeGarden), so a sync that changed nothing still tore down
  // and rebuilt the OS's entire queue; and re-timing every reminder at once
  // would have cost three full rebuilds instead of one. It includes everything
  // that moves a date (startAt) or changes banner text (titles, room names).
  const scheduleKey = useMemo(
    () =>
      state.reminders
        .map(
          (r) =>
            `${r.id}|${r.enabled ? 1 : 0}|${r.intervalDays}|${r.timeOfDay}|${r.startAt}|${r.lastDoneAt}|${r.snoozedUntil}|${r.title}`,
        )
        .join(';') +
      '#' +
      state.plants
        .map((p) => `${p.id}|${p.archived ? 1 : 0}|${p.nickname}|${p.roomId}`)
        .join(';') +
      '#' +
      state.rooms.map((r) => `${r.id}|${r.name}`).join(';'),
    [state.reminders, state.plants, state.rooms],
  );

  // The OS queue is a bounded window (notifications/index.js), so it drains as
  // days pass even when nothing is edited. Refill it whenever the app becomes
  // active and whenever the local day turns over; and rebuild when permission
  // changes, since a grant in iOS Settings otherwise schedules nothing until
  // the garden next changes. All through the same debounce.
  const dayKey = localDayKey(now);
  const notificationPermission = prefs.notificationPermission;
  const notificationsEnabled = prefs.notificationsEnabled;
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(
      () => rescheduleAll(latest.current, undefined, { notificationsEnabled }),
      RESCHEDULE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [scheduleKey, ready, notificationsEnabled, dayKey, resumeCount, notificationPermission]);

  // --- clock + foreground -------------------------------------------------
  useEffect(() => {
    const tick = clock ? null : setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        // Time passed while we were away: dates, and anything another device
        // changed, are both stale.
        if (!clock) setNow(new Date());
        setResumeCount((n) => n + 1);
        runSync();
      } else {
        // The process may not get another chance to write.
        saver.current.flush();
      }
    });
    return () => {
      if (tick) clearInterval(tick);
      sub.remove();
    };
  }, [runSync, clock]);

  // ------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------
  const actions = useMemo(() => {
    const at = () => clock ?? new Date();
    // Every mutation is stamped from the same clock the derived views read, so
    // a reminder completed "now" is next due a whole interval from that same
    // instant — and a frozen clock makes the whole store deterministic.
    const commit = (action) => dispatch({ now: at().toISOString(), ...action });

    /**
     * What an undo has to put back. Read before the dispatch, from the last
     * committed state, so it is the pre-mutation truth. `wasQueued` records
     * whether a completion was *already* waiting to push — undoing must not
     * drop an earlier completion nobody took back.
     */
    const snapshot = (ids) => {
      const before = latest.current;
      return ids.flatMap((id) => {
        const r = before.reminders.find((x) => x.id === id);
        return r
          ? [{
            id,
            lastDoneAt: r.lastDoneAt ?? null,
            snoozedUntil: r.snoozedUntil ?? null,
            updatedAt: r.updatedAt,
            wasQueued: before.outbox.some(
              (e) => e.op === 'reminder.complete' && e.localId === id,
            ),
          }]
          : [];
      });
    };

    /**
     * The token behind the snackbar's Undo. It owns the sync hold, so a caller
     * that shows the bar and forgets to retire the token delays a push — it
     * cannot desync the document.
     *
     * @returns {{count: number, undo: () => void, drop: () => void} | null}
     *          null when the mutation touched nothing
     */
    const undoable = (entries) => {
      if (entries.length === 0) return null;
      const release = holdSync();
      let spent = false;
      return {
        count: entries.length,
        undo() {
          if (spent) return;
          spent = true;
          commit({ type: 'reminders/restore', entries });
          release();
        },
        drop() {
          if (spent) return;
          spent = true;
          release();
        },
      };
    };

    return {
      /**
       * Commit the add-a-plant flow.
       *
       * `care` is the raw SpeciesDetail, cached on the plant so its product
       * page renders in full offline. `reminders` are the rows the flow
       * enabled: `{ action, title, intervalDays, startAt? }`. A row with a
       * `startAt` (a custom reminder's chosen day) first comes due on that day;
       * the rest are anchored to now, so they fall a full interval out rather
       * than immediately. An unparsable `startAt` counts as absent.
       */
      addPlant({ speciesKey, nickname, roomId = null, care = null, heroUri = null, reminders = [] }) {
        const when = at();
        const plant = makePlant({ speciesKey, nickname, roomId, care, heroUri, now: when });
        const startOf = (r) =>
          r.startAt && !Number.isNaN(Date.parse(r.startAt)) ? r.startAt : null;
        const rows = reminders.map((r) =>
          makeReminder({
            plantId: plant.id,
            action: r.action,
            title: r.title,
            intervalDays: r.intervalDays ?? actionMeta(r.action).defaultIntervalDays,
            // The user's global reminder time is the default; DEFAULT_TIME_OF_DAY
            // is only the last resort when there is no provider (isolated tests).
            timeOfDay: r.timeOfDay ?? prefsRef.current.reminderTime ?? DEFAULT_TIME_OF_DAY,
            enabled: r.enabled !== false,
            startAt: startOf(r),
            now: when,
          }),
        );
        // A suggested reminder added now counts as having just been done, so a
        // 7-day watering is next due in 7 days. One with a chosen start day is
        // left undone, so nextDueAt anchors it on that day instead. Either way
        // it is what the flow's success line promises.
        rows.forEach((row, i) => {
          if (!startOf(reminders[i])) row.lastDoneAt = when.toISOString();
        });

        commit({ type: 'plant/add', plant, reminders: rows });
        // The first plant is the first moment a reminder can matter, and the
        // only honest moment to ask.
        if (rows.length > 0) ensurePermission();
        return plant.id;
      },

      renamePlant: (id, nickname) => commit({ type: 'plant/rename', id, nickname }),
      movePlant: (id, roomId) => commit({ type: 'plant/move', id, roomId }),
      archivePlant: (id, archived = true) => commit({ type: 'plant/archive', id, archived }),
      deletePlant: (id) => commit({ type: 'plant/delete', id }),
      // The catalog's own `image_url` is root-relative; absolutise it here, the
      // same way store/sync.js does on the pull, or the reducer's heroUri
      // fallback stores a path <Image> cannot load.
      setPlantCare: (id, care) =>
        commit({
          type: 'plant/care',
          id,
          care: care ? { ...care, image_url: mediaUrl(care.image_url) } : care,
        }),

      /**
       * Set a plant's own photo.
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
       * Create a room and hand back its id, so a caller can select it. The icon
       * follows the name until the backend lets a user pick one.
       */
      addRoom(name) {
        const room = makeRoom({ name, now: at() });
        commit({ type: 'room/add', room });
        return room.id;
      },
      renameRoom: (id, name) => commit({ type: 'room/rename', id, name }),
      /** Delete a room; its plants stay, without a room. */
      deleteRoom: (id) => commit({ type: 'room/delete', id }),
      /** "Move and delete room": re-home every plant in it, then delete it. */
      deleteRoomMovingPlants: (id, toRoomId) =>
        commit({ type: 'room/deleteMoving', id, toRoomId }),

      addReminder(plantId, { action = 'custom', title, intervalDays, startAt, timeOfDay }) {
        const reminder = makeReminder({
          plantId,
          action,
          title,
          intervalDays,
          startAt,
          timeOfDay: timeOfDay ?? prefsRef.current.reminderTime ?? DEFAULT_TIME_OF_DAY,
          now: at(),
        });
        commit({ type: 'reminder/add', reminder });
        ensurePermission();
        return reminder.id;
      },

      updateReminder: (id, patch) => commit({ type: 'reminder/update', id, patch }),
      toggleReminder: (id, enabled) =>
        commit({ type: 'reminder/update', id, patch: { enabled } }),
      deleteReminder: (id) => commit({ type: 'reminder/delete', id }),
      /** @returns an undo token for the snackbar, or null if there was no row. */
      completeReminder(id) {
        const entries = snapshot([id]);
        commit({ type: 'reminder/complete', id });
        return undoable(entries);
      },

      /** Complete several at once ("Complete All" on the Today screen). */
      completeReminders(ids) {
        const entries = snapshot(ids);
        const stamp = at().toISOString();
        for (const id of ids) commit({ type: 'reminder/complete', id, at: stamp });
        return undoable(entries);
      },

      /**
       * Push one occurrence out by `ms`, leaving the cadence alone. A falsy
       * `ms` clears the snooze rather than snoozing to this instant — that is
       * what picking "None" on the snooze wheel means.
       */
      snoozeReminder(id, ms) {
        const entries = snapshot([id]);
        const until = ms > 0 ? new Date(at().getTime() + ms).toISOString() : null;
        commit({ type: 'reminder/snooze', id, until });
        // A snooze queues nothing (the server has no column for it), so this
        // token holds the sync only for symmetry — undo is the point.
        return undoable(entries);
      },

      /**
       * Move every reminder to a new time of day (Settings → Notifications).
       *
       * The name is deliberately blunt: the setting reads "Reminders arrive at
       * this time", and nothing in the UI sets a reminder's time individually,
       * so there is no user intent to preserve. See the reducer case — the day
       * a per-reminder time picker ships, this has to learn to leave customised
       * ones alone.
       */
      retimeAllReminders: (timeOfDay) =>
        commit({ type: 'reminders/timeOfDay', timeOfDay, now: at() }),

      // No setProfileName: auth owns the name (auth.updateProfileName) and the
      // effect above mirrors it here. A second public writer is how that
      // invariant gets broken.
      sync: runSync,
    };
  }, [runSync, holdSync, clock]);

  // ------------------------------------------------------------------------
  // Derived views
  // ------------------------------------------------------------------------
  const value = useMemo(() => {
    const plants = livePlants(state);
    return {
      ready,
      state,
      now,
      plants,
      rooms: sortedRooms(state),
      reminders: state.reminders,
      profileName: state.profileName,
      pendingSync: state.outbox.length,

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

      ...actions,
    };
  }, [state, ready, now, actions]);

  return <GardenContext.Provider value={value}>{children}</GardenContext.Provider>;
}

export function useGarden() {
  const ctx = useContext(GardenContext);
  if (!ctx) throw new Error('useGarden must be used inside a <GardenProvider>.');
  return ctx;
}
