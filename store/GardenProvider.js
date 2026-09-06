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
} from './model';
import { createSaver, loadState } from './persist';
import { reducer } from './reducer';
import { nextTaskForPlant, plantTasks, todayTasks, upcomingTasks } from './schedule';
import { syncGarden } from './sync';

const GardenContext = createContext(null);

/** Derived views are recomputed against a clock that ticks slowly; a due-date
 *  boundary is minutes-granular at worst, and re-rendering every second to
 *  chase it would cost more than it buys. */
const CLOCK_TICK_MS = 5 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 400;
const SYNC_DEBOUNCE_MS = 2000;
const RESCHEDULE_DEBOUNCE_MS = 1500;

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

  const saver = useRef(null);
  if (!saver.current) saver.current = createSaver(SAVE_DEBOUNCE_MS);

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
    if (ready && name && name !== state.profileName) {
      dispatch({ type: 'profile/name', name });
    }
  }, [ready, auth?.profileName, state.profileName]);

  // --- sync ---------------------------------------------------------------
  const syncing = useRef(false);
  const runSync = useCallback(async () => {
    // A dev-bypass session has no real credentials — calling the garden
    // endpoints with them would 401, and apiFetch answers a 401 by rotating
    // the session, which would end it.
    if (syncing.current || status !== 'signedIn' || devSession) return;
    syncing.current = true;
    try {
      const merged = await syncGarden(latest.current);
      if (merged) dispatch({ type: 'state/replace', state: merged });
    } finally {
      syncing.current = false;
    }
  }, [status, devSession]);

  // Keyed on the outbox, not on the whole document: a successful pull replaces
  // plants, reminders and rooms wholesale, so depending on `state` would make
  // every sync trigger the next one, forever. The outbox is the only thing that
  // says there is something new to push, and a pull that changes nothing leaves
  // it identical.
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(runSync, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.outbox, ready, runSync]);

  // --- notifications ------------------------------------------------------
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(() => rescheduleAll(latest.current), RESCHEDULE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, ready]);

  // --- clock + foreground -------------------------------------------------
  useEffect(() => {
    const tick = clock ? null : setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        // Time passed while we were away: dates, and anything another device
        // changed, are both stale.
        if (!clock) setNow(new Date());
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

    return {
      /**
       * Commit the add-a-plant flow.
       *
       * `care` is the raw SpeciesDetail, cached on the plant so its product
       * page renders in full offline. `reminders` are the rows the flow
       * enabled: `{ action, intervalDays }`, each anchored to now so the first
       * one falls a full interval out rather than immediately.
       */
      addPlant({ speciesKey, nickname, roomId = null, care = null, heroUri = null, reminders = [] }) {
        const when = at();
        const plant = makePlant({ speciesKey, nickname, roomId, care, heroUri, now: when });
        const rows = reminders.map((r) =>
          makeReminder({
            plantId: plant.id,
            action: r.action,
            title: r.title,
            intervalDays: r.intervalDays ?? actionMeta(r.action).defaultIntervalDays,
            timeOfDay: r.timeOfDay ?? DEFAULT_TIME_OF_DAY,
            enabled: r.enabled !== false,
            now: when,
          }),
        );
        // Adding it now counts as having just done it, so a 7-day watering is
        // next due in 7 days — which is what the flow's success line promises.
        for (const row of rows) row.lastDoneAt = when.toISOString();

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
      setPlantCare: (id, care) => commit({ type: 'plant/care', id, care }),
      setPlantPhoto: (id, uri) => commit({ type: 'plant/photo', id, uri }),

      /** Create a room and hand back its id, so a caller can select it. */
      addRoom(name, icon) {
        const room = makeRoom(name, icon);
        commit({ type: 'room/add', room });
        return room.id;
      },
      renameRoom: (id, name) => commit({ type: 'room/rename', id, name }),
      deleteRoom: (id) => commit({ type: 'room/delete', id }),

      addReminder(plantId, { action = 'custom', title, intervalDays, startAt, timeOfDay }) {
        const reminder = makeReminder({
          plantId,
          action,
          title,
          intervalDays,
          startAt,
          timeOfDay,
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
      completeReminder: (id) => commit({ type: 'reminder/complete', id }),

      /** Complete several at once ("Complete All" on the Today screen). */
      completeReminders(ids) {
        const stamp = at().toISOString();
        for (const id of ids) commit({ type: 'reminder/complete', id, at: stamp });
      },

      /**
       * Push one occurrence out by `ms`, leaving the cadence alone. A falsy
       * `ms` clears the snooze rather than snoozing to this instant — that is
       * what picking "None" on the snooze wheel means.
       */
      snoozeReminder(id, ms) {
        const until = ms > 0 ? new Date(at().getTime() + ms).toISOString() : null;
        commit({ type: 'reminder/snooze', id, until });
      },

      setProfileName: (name) => commit({ type: 'profile/name', name }),
      sync: runSync,
    };
  }, [runSync, clock]);

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
      rooms: state.rooms,
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
