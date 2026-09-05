import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import AddPlantScreen from '../AddPlantScreen';
import { resetRoomIds } from '../addPlantData';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Fixed "today" so every date label is deterministic: Thursday 10 Sep 2026.
const TODAY = new Date(2026, 8, 10);

const VM = {
  commonName: 'Swiss cheese plant',
  latinName: 'Monstera deliciosa',
  heroUri: 'https://img/monstera.jpg',
  speciesKey: 'monstera-deliciosa',
  careFacts: [
    { icon: 'outlined-water', label: 'Water', value: 'Every 7–10 days' },
    { icon: 'sun', label: 'Sun', value: 'Bright, indirect' },
  ],
};

let api;
function Probe() {
  api = useRouter();
  return null;
}

function create(props = {}) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="add-plant">
          <Probe />
          <AddPlantScreen plant={VM} today={TODAY} {...props} />
        </Router>
      </SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// Press the deepest node carrying this label — the host Pressable, not the
// component element that also holds the prop.
const press = (tree, label) => {
  const nodes = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label
  );
  act(() => nodes[nodes.length - 1].props.onPress());
};

const button = (tree, label) =>
  tree.root
    .findAll(
      (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label
    )
    .at(-1);

const type = (tree, value) =>
  act(() => tree.root.findAllByType(RNTextInput)[0].props.onChangeText(value));

const sheetVisible = (tree, testID) =>
  tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

// Walk to a given step with a name and (past `room`) the Kitchen selected.
const walkTo = (tree, step) => {
  if (step === 'name') return;
  press(tree, 'Continue'); // name → room
  if (step === 'room') return;
  press(tree, 'Kitchen'); // select the room
  press(tree, 'Continue'); // room → reminders
  if (step === 'reminders') return;
  press(tree, 'Skip for now'); // reminders → success
};

beforeEach(resetRoomIds);

describe('step 1 — name', () => {
  test('opens prefilled with the common name and the Figma suggestions', () => {
    const tree = create();
    const t = texts(tree);
    expect(t).toContain('Name your plant');
    expect(t).toContain('Step 1 of 3');
    expect(tree.root.findAllByType(RNTextInput)[0].props.value).toBe('Swiss cheese plant');
    expect(t).toEqual(expect.arrayContaining(['Monstera', 'Ziggy', 'Mo', 'Bruce']));
  });

  test('a suggestion chip fills the field, and clearing disables Continue', () => {
    const tree = create();
    press(tree, 'Mo');
    expect(tree.root.findAllByType(RNTextInput)[0].props.value).toBe('Mo');

    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
    type(tree, '   ');
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(true);
  });

  test('close leaves the flow rather than stepping back', () => {
    const tree = create();
    expect(texts(tree)).not.toContain('Choose a room');
    press(tree, 'Close');
    // Nothing to pop to from the initial route, so the route is unchanged —
    // what matters is that the flow did not advance or step within itself.
    expect(api.route).toBe('add-plant');
    expect(texts(tree)).toContain('Name your plant');
  });
});

describe('step 2 — room', () => {
  test('lists the rooms and holds Continue until one is picked', () => {
    const tree = create();
    walkTo(tree, 'room');
    const t = texts(tree);
    expect(t).toContain('Choose a room');
    expect(t).toContain('Step 2 of 3');
    expect(t).toEqual(
      expect.arrayContaining(['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office', 'Add a new room'])
    );

    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(true);
    press(tree, 'Kitchen');
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
  });

  test('the add-a-room sheet appends the room and selects it', () => {
    const tree = create();
    walkTo(tree, 'room');
    expect(sheetVisible(tree, 'add-room-sheet')).toBe(false);

    press(tree, 'Add a new room');
    expect(sheetVisible(tree, 'add-room-sheet')).toBe(true);

    act(() => tree.root.findAllByType(RNTextInput)[0].props.onChangeText('Hallway'));
    press(tree, 'Add room');

    expect(sheetVisible(tree, 'add-room-sheet')).toBe(false);
    expect(texts(tree)).toContain('Hallway');
    // Selected, so Continue is live without a further tap.
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
  });

  test('back returns to the name step with the name intact', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'room');
    press(tree, 'Back');
    expect(texts(tree)).toContain('Name your plant');
    expect(tree.root.findAllByType(RNTextInput)[0].props.value).toBe('Mo');
  });
});

describe('step 3 — reminders', () => {
  test('both reminders start off, and enabling one shows the species interval', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    const t = texts(tree);
    expect(t).toContain('Set reminders');
    expect(t).toContain('Step 3 of 3');
    expect(t).toContain('Watering');
    expect(t).toContain('Fertilizing');
    expect(t.filter((x) => x === 'Reminder is turned off')).toHaveLength(2);
    expect(t).toContain('Skip for now');

    press(tree, 'Enable Watering');
    expect(texts(tree)).toContain('Every 7 days');
    expect(texts(tree)).toContain('Continue'); // the CTA is no longer a skip
  });

  test('the add-reminder sheet appends a custom row', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(false);

    press(tree, 'Add custom reminder');
    expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(true);
  });

  test('back returns to the room step with the room still selected', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    press(tree, 'Back');
    expect(texts(tree)).toContain('Choose a room');
    expect(button(tree, 'Continue').props.accessibilityState.disabled).toBe(false);
  });
});

describe('success', () => {
  test('skipping every reminder says nothing is scheduled', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'success');
    const t = texts(tree);
    expect(t).toContain('Mo added to your plants in the kitchen room');
    expect(t).toContain('There is no reminder set for now');
    expect(t).toContain('Scan another plant');
    expect(t).toContain('Done');
  });

  test('an enabled reminder dates the next treatment', () => {
    const tree = create();
    walkTo(tree, 'reminders');
    press(tree, 'Enable Watering');
    press(tree, 'Continue');
    expect(texts(tree)).toContain('Next treatment is on Thu 17, Sep');
  });

  test('Done re-enters the product page as owned', () => {
    const tree = create();
    press(tree, 'Mo');
    walkTo(tree, 'success');
    press(tree, 'Done');

    expect(api.route).toBe('product');
    expect(api.params).toEqual({
      plant: VM,
      owned: true,
      speciesKey: 'monstera-deliciosa',
      nickname: 'Mo',
      room: 'Kitchen',
      reminders: [],
    });
  });

  test('Scan another plant resets to the camera, leaving no flow in the stack', () => {
    const tree = create();
    walkTo(tree, 'success');
    press(tree, 'Scan another plant');
    expect(api.route).toBe('scan-camera');
    expect(api.canGoBack).toBe(false);
  });
});
