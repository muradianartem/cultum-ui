// Test harness for anything that reads the garden.
//
// Not a test file (it lives outside __tests__ so jest doesn't try to run it):
// screen tests import `renderWithGarden` to mount a component over a real
// GardenProvider seeded with real plants and reminders, talking to an
// in-memory backend (`fakeGardenApi`), so what they assert is what the store
// would actually produce from a server's answers.

import { actionMeta, emptyState, makePlant, makeReminder, makeRoom } from './model';

/**
 * Build a garden document from a compact description.
 *
 * Reminders are anchored to the caller's clock rather than the wall clock, so a
 * test that reasons about "today" stays true tomorrow.
 *
 *   seedGarden({ now, rooms: ['Office'],
 *                plants: [{ nickname: 'Penny', room: 'Kitchen',
 *                           reminders: [{ action: 'water', dueInDays: 0 }] }] })
 *
 * Rooms are created on first mention — `rooms` first, then each plant's `room`
 * — with a readable id slugged from the name ("Living Room" → "living-room"),
 * so a test can address one without digging it out of the document.
 */
export function seedGarden({ plants = [], rooms = [], now = new Date() } = {}) {
  const base = emptyState();
  const outRooms = [];
  const outPlants = [];
  const outReminders = [];

  const roomNamed = (name) => {
    if (!name) return null;
    const want = String(name).toLowerCase();
    let room = outRooms.find((r) => r.name.toLowerCase() === want);
    if (!room) {
      room = { ...makeRoom({ name, now, sortOrder: outRooms.length }), id: slug(name) };
      outRooms.push(room);
    }
    return room;
  };
  for (const name of rooms) roomNamed(name);

  for (const spec of plants) {
    const room = roomNamed(spec.room);
    const plant = {
      ...makePlant({
        speciesKey: spec.speciesKey ?? 'monstera-deliciosa',
        nickname: spec.nickname,
        roomId: room?.id ?? null,
        care: spec.care ?? null,
        heroUri: spec.heroUri ?? null,
        now,
      }),
    };
    outPlants.push(plant);

    for (const r of spec.reminders ?? []) {
      const reminder = makeReminder({
        plantId: plant.id,
        action: r.action ?? 'water',
        title: r.title,
        intervalDays: r.intervalDays ?? 7,
        enabled: r.enabled !== false,
        // `dueInDays` is the readable knob: 0 is due today, -3 is three days
        // overdue, 5 is five days out.
        startAt: shift(now, r.dueInDays ?? 0).toISOString(),
        now,
      });
      outReminders.push({ ...reminder, ...(r.overrides ?? {}) });
    }
  }

  return { ...base, status: 'ready', rooms: outRooms, plants: outPlants, reminders: outReminders };
}

// ---------------------------------------------------------------------------
// A fake backend
// ---------------------------------------------------------------------------

/**
 * The garden and rooms endpoints (api/garden.js + api/rooms.js), answered from
 * memory the way the real backend would. Seed it with a garden document —
 * every entity's id is taken as its server id.
 *
 *   const api = fakeGardenApi(seedGarden({ ... }));
 *   api.fail('addPlant', Object.assign(new Error('x'), { status: 403 }));
 *   api.calls  // [['addPlant', {...}], ...]
 *
 * `fail(name, error)` makes the next call to `name` reject with `error`
 * (pass `{ times }` for more than one).
 */
export function fakeGardenApi(doc = emptyState()) {
  let n = 0;
  const id = (prefix) => `${prefix}-${(n += 1)}`;
  const rooms = new Map(
    (doc.rooms ?? []).map((r) => [
      r.id,
      { id: r.id, name: r.name, icon: r.icon ?? null, light: r.light ?? 'unknown', sort_order: r.sortOrder ?? 0 },
    ]),
  );
  const plants = new Map(
    (doc.plants ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        species_key: p.speciesKey,
        nickname: p.nickname,
        room_id: p.roomId ?? null,
        acquired_at: p.acquiredAt ?? null,
        care: p.care ?? null,
        image_url: p.heroUri ?? null,
      },
    ]),
  );
  const reminders = new Map(
    (doc.reminders ?? []).map((r) => [
      r.id,
      {
        id: r.id,
        user_plant_id: r.plantId,
        type: actionMeta(r.action).serverType,
        interval_days: r.intervalDays,
        time_of_day: r.timeOfDay,
        enabled: r.enabled !== false,
        last_done_at: r.lastDoneAt ?? null,
      },
    ]),
  );

  const failures = new Map();
  const calls = [];
  const notFound = () => Object.assign(new Error('Not Found'), { status: 404, code: 'http' });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const withReminders = (p) => ({
    ...p,
    reminders: [...reminders.values()].filter((r) => r.user_plant_id === p.id),
  });

  const endpoints = {
    listRooms: () =>
      [...rooms.values()].map((r) => ({
        ...r,
        plant_count: [...plants.values()].filter((p) => p.room_id === r.id).length,
      })),
    getGarden: () => [...plants.values()].map(withReminders),
    createRoom: ({ name, icon, light, sortOrder }) => {
      const room = { id: id('room'), name, icon: icon ?? null, light: light ?? 'unknown', sort_order: sortOrder ?? 0 };
      rooms.set(room.id, room);
      return room;
    },
    updateRoom: (roomId, patch) => {
      const room = rooms.get(roomId);
      if (!room) throw notFound();
      if (patch.name !== undefined) room.name = patch.name;
      if (patch.icon !== undefined) room.icon = patch.icon;
      return room;
    },
    deleteRoom: (roomId) => {
      if (!rooms.delete(roomId)) throw notFound();
      for (const p of plants.values()) if (p.room_id === roomId) p.room_id = null;
      return null;
    },
    addPlant: ({ speciesKey, nickname, roomId, acquiredAt }) => {
      if (roomId && !rooms.has(roomId)) throw Object.assign(new Error('Unknown room'), { status: 422, code: 'http' });
      const plant = {
        id: id('plant'),
        species_key: speciesKey,
        nickname: nickname ?? null,
        room_id: roomId ?? null,
        acquired_at: acquiredAt ?? null,
        care: null,
        image_url: null,
      };
      plants.set(plant.id, plant);
      return withReminders(plant);
    },
    updatePlant: (plantId, { nickname, roomId }) => {
      const plant = plants.get(plantId);
      if (!plant) throw notFound();
      if (nickname !== undefined) plant.nickname = nickname;
      if (roomId !== undefined) plant.room_id = roomId;
      return withReminders(plant);
    },
    removePlant: (plantId) => {
      if (!plants.delete(plantId)) throw notFound();
      for (const r of [...reminders.values()]) if (r.user_plant_id === plantId) reminders.delete(r.id);
      return null;
    },
    createReminder: (plantId, r) => {
      if (!plants.has(plantId)) throw notFound();
      const reminder = {
        id: id('rem'),
        user_plant_id: plantId,
        type: r.type,
        interval_days: r.intervalDays,
        time_of_day: r.timeOfDay ?? null,
        enabled: r.enabled !== false,
        last_done_at: null,
      };
      reminders.set(reminder.id, reminder);
      return reminder;
    },
    updateReminder: (reminderId, patch) => {
      const r = reminders.get(reminderId);
      if (!r) throw notFound();
      if (patch.type !== undefined) r.type = patch.type;
      if (patch.intervalDays !== undefined) r.interval_days = patch.intervalDays;
      if (patch.timeOfDay !== undefined) r.time_of_day = patch.timeOfDay;
      if (patch.enabled !== undefined) r.enabled = patch.enabled;
      return r;
    },
    deleteReminder: (reminderId) => {
      if (!reminders.delete(reminderId)) throw notFound();
      return null;
    },
    completeReminder: (reminderId) => {
      const r = reminders.get(reminderId);
      if (!r) throw notFound();
      r.last_done_at = new Date().toISOString();
      return r;
    },
  };

  const api = { calls, rooms, plants, reminders };
  for (const [name, fn] of Object.entries(endpoints)) {
    api[name] = async (...args) => {
      calls.push([name, ...args]);
      const failure = failures.get(name);
      if (failure) {
        failure.times -= 1;
        if (failure.times <= 0) failures.delete(name);
        throw failure.error;
      }
      return clone(fn(...args));
    };
  }
  api.fail = (name, error, { times = 1 } = {}) => failures.set(name, { error, times });
  /** Calls made to one endpoint, as argument lists. */
  api.callsTo = (name) => calls.filter((c) => c[0] === name).map((c) => c.slice(1));
  return api;
}

const slug = (name) =>
  String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const shift = (from, n) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + n, from.getHours());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
//
// Test-only, and never imported by the app — Metro only bundles what is
// reached from index.js, so react-test-renderer stays out of the app.

import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../routing';
import { GardenProvider } from './GardenProvider';
import { SnackbarProvider } from '../components/SnackbarProvider';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mounted = [];

/**
 * Unmount every tree this file created.
 *
 * Call it from an `afterEach`. GardenProvider holds a clock interval and an
 * AppState subscription, and both are only released on unmount — leave a tree
 * mounted and the jest worker never exits.
 */
export function cleanupTrees() {
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
}

/**
 * Mount `element` over a real GardenProvider seeded with `state`, inside a
 * Router and a SafeAreaProvider.
 *
 * @returns {{ tree, router, texts, find, press }}
 */
export function renderWithGarden(element, { state, initial = 'today', clock, api } = {}) {
  const server = api ?? fakeGardenApi(state);
  let router;
  function Probe() {
    router = useRouter();
    return null;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GardenProvider initialState={state} clock={clock} api={server}>
          <SnackbarProvider>
            <Router initial={initial}>
              <Probe />
              {element}
            </Router>
          </SnackbarProvider>
        </GardenProvider>
      </SafeAreaProvider>,
    );
  });
  mounted.push(tree);

  /** Every string rendered anywhere in the tree, flattened. */
  const texts = () => tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

  /**
   * The deepest pressable carrying this label — the host Pressable, not the
   * component element that also holds the prop.
   */
  const find = (label) => {
    const nodes = tree.root.findAll(
      (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label,
    );
    return nodes[nodes.length - 1];
  };

  /** Fire that pressable, failing loudly when it isn't there. */
  const press = (label) => {
    const node = find(label);
    if (!node) throw new Error(`No pressable labelled “${label}”`);
    // Braced: an async handler's promise must not turn this into an async
    // act. `settle()` is how a test waits for the request it made.
    act(() => {
      node.props.onPress();
    });
  };

  /**
   * Let every pending request settle: the fake backend answers on the
   * microtask queue, and an action awaits several answers in a row.
   */
  const settle = async () => {
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  /** Type into the nth text field on screen. */
  const type = (value, index = 0) =>
    act(() => tree.root.findAllByType(RNTextInput)[index].props.onChangeText(value));

  return {
    tree,
    api: server,
    get router() {
      return router;
    },
    texts,
    find,
    press,
    settle,
    type,
  };
}
