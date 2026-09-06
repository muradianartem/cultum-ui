import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import RoomsScreen from '../RoomsScreen';
import RoomScreen from '../RoomScreen';
import { ROOMS } from '../roomsData';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let api;
function Probe() {
  api = useRouter();
  return null;
}

function create(node, initial = 'rooms') {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial={initial}>
          <Probe />
          {node}
        </Router>
      </SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

const type = (tree, value) =>
  act(() => tree.root.findAllByType(RNTextInput)[0].props.onChangeText(value));

// Press the deepest node carrying this label — the host Pressable, not the
// component element that also holds the prop.
const press = (tree, label) => {
  const nodes = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label
  );
  act(() => nodes[nodes.length - 1].props.onPress());
};

describe('RoomsScreen', () => {
  test('idle lists every room with its meta line', () => {
    const t = texts(create(<RoomsScreen />));
    expect(t).toContain('Rooms');
    expect(t).toContain('Living Room');
    expect(t).toContain('Kitchen');
    expect(t).toContain('Bedroom');
    expect(t).toContain('3 plants · 2 to check');
  });

  test('a plant-only query shows the plant cards and no rooms or headers', () => {
    const tree = create(<RoomsScreen />);
    type(tree, 'monstera');
    const t = texts(tree);
    expect(t).toContain('Kitchen Monstera');
    expect(t).toContain('Mo');
    expect(t).not.toContain('Living Room');
    // "Rooms" is still the nav title, but no "Plants" section header appears
    // when only one kind matched.
    expect(t).not.toContain('Plants');
  });

  test('a query hitting both kinds renders both sections, with headers', () => {
    const tree = create(<RoomsScreen />);
    type(tree, 'kitchen');
    const t = texts(tree);
    expect(t).toContain('Plants'); // section header
    expect(t).toContain('Kitchen'); // the room card
    expect(t).toContain('Kitchen Monstera'); // the plant card
    expect(t).not.toContain('Bedroom');
  });

  test('a miss shows the empty state', () => {
    const tree = create(<RoomsScreen />);
    type(tree, 'zzzz');
    const t = texts(tree);
    expect(t).toContain('No results found');
    expect(t).not.toContain('Living Room');
  });

  test('clearing the query goes back to the full list', () => {
    const tree = create(<RoomsScreen />);
    type(tree, 'zzzz');
    type(tree, '');
    expect(texts(tree)).toContain('Living Room');
  });

  test('tapping a room navigates to it with the room as a param', () => {
    const tree = create(<RoomsScreen />);
    press(tree, 'Living Room, 3 plants · 2 to check');
    expect(api.route).toBe('room');
    expect(api.params.room.id).toBe('living-room');
  });
});

describe('RoomScreen', () => {
  const LIVING = ROOMS[0];

  test('renders the room name, plant count and its plants', () => {
    const t = texts(create(<RoomScreen room={LIVING} />, 'room'));
    expect(t).toContain('Living Room');
    expect(t).toContain('3 plants');
    expect(t).toContain('Penny');
    expect(t).toContain('Figgy');
    expect(t).toContain('Lily');
  });

  test('an empty room falls back to the empty state', () => {
    const t = texts(create(<RoomScreen room={{ ...LIVING, plants: [] }} />, 'room'));
    expect(t).toContain('No plants here yet');
  });

  test('the pen opens the rename sheet, and saving updates the title', () => {
    const tree = create(<RoomScreen room={LIVING} />, 'room');
    press(tree, 'Rename room');
    expect(texts(tree)).toContain('Rename room');

    type(tree, 'Lounge');
    press(tree, 'Save');
    expect(texts(tree)).toContain('Lounge');
    expect(texts(tree)).not.toContain('Living Room');
  });
});
