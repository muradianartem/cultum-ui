// Test harness for anything that reads the garden.
//
// Not a test file (it lives outside __tests__ so jest doesn't try to run it):
// screen tests import `renderGarden` to mount a component over a real
// GardenProvider seeded with real plants and reminders, so what they assert is
// what the store would actually produce.

import { emptyState, makePlant, makeReminder } from './model';

/**
 * Build a garden document from a compact description.
 *
 * Reminders are anchored to the caller's clock rather than the wall clock, so a
 * test that reasons about "today" stays true tomorrow.
 *
 *   seedGarden({ now, plants: [{ nickname: 'Penny', room: 'Kitchen',
 *                                reminders: [{ action: 'water', dueInDays: 0 }] }] })
 */
export function seedGarden({ plants = [], now = new Date() } = {}) {
  const base = emptyState();
  const outPlants = [];
  const outReminders = [];

  for (const spec of plants) {
    const room = base.rooms.find(
      (r) => r.name.toLowerCase() === String(spec.room ?? '').toLowerCase(),
    );
    const plant = {
      ...makePlant({
        speciesKey: spec.speciesKey ?? 'monstera-deliciosa',
        nickname: spec.nickname,
        roomId: room?.id ?? null,
        care: spec.care ?? null,
        heroUri: spec.heroUri ?? null,
        now,
      }),
      serverId: spec.serverId ?? null,
      archived: spec.archived ?? false,
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

  return { ...base, plants: outPlants, reminders: outReminders };
}

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
export function renderWithGarden(element, { state, initial = 'today', clock } = {}) {
  let router;
  function Probe() {
    router = useRouter();
    return null;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GardenProvider initialState={state} clock={clock}>
          <Router initial={initial}>
            <Probe />
            {element}
          </Router>
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
    act(() => node.props.onPress());
  };

  /** Type into the nth text field on screen. */
  const type = (value, index = 0) =>
    act(() => tree.root.findAllByType(RNTextInput)[index].props.onChangeText(value));

  return {
    tree,
    get router() {
      return router;
    },
    texts,
    find,
    press,
    type,
  };
}
