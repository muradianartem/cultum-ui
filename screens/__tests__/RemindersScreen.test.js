import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../routing';
import { WheelPicker } from '../../components';
import RemindersScreen from '../RemindersScreen';

// Insets need a provider; feed fixed metrics so useSafeAreaInsets resolves.
const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let api;
function Probe() {
  api = useRouter();
  return null;
}

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="reminders">
          <Probe />
          {el}
        </Router>
      </SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// Every Toggle renders a host node with accessibilityRole="switch".
const switches = (tree) =>
  tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'switch'
  );

test('renders the three reminder titles and the Add Reminder row', () => {
  const tree = create(<RemindersScreen />);
  const t = texts(tree);
  expect(t).toContain('Watering');
  expect(t).toContain('Fertilizing');
  expect(t).toContain('Check for better pods');
  expect(t).toContain('Add Reminder');
});

test('renders one enable toggle per reminder; built-ins on, custom off', () => {
  const tree = create(<RemindersScreen />);
  const sw = switches(tree);
  expect(sw).toHaveLength(3);
  const checked = sw.map((n) => n.props.accessibilityState.checked);
  // Watering + Fertilizing enabled, the custom "Check for better pods" off.
  expect(checked).toEqual([true, true, false]);
});

// Fire the onPress of the pressable carrying `label` (Pressable exposes onPress
// on its node; the host it renders carries accessibilityState).
const press = (tree, label) => {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label
  );
  act(() => node.props.onPress());
};

test('pressing a toggle flips its checked state', () => {
  const tree = create(<RemindersScreen />);
  // The custom reminder starts off (3rd switch).
  expect(switches(tree)[2].props.accessibilityState.checked).toBe(false);
  press(tree, 'Enable Check for better pods');
  expect(switches(tree)[2].props.accessibilityState.checked).toBe(true);
});

test('each card shows its detail rows (date / Frequency / Snooze for)', () => {
  const tree = create(<RemindersScreen />);
  const t = texts(tree);
  // Built-in date label, plus the two fixed labels and their seeded values.
  expect(t).toContain('Last watering');
  expect(t).toContain('Start date'); // the custom reminder's date label
  expect(t).toContain('Frequency');
  expect(t).toContain('Snooze for');
  expect(t).toContain('7 days'); // frequency value
  expect(t).toContain('None'); // snooze value
});

test('only the removable (custom) reminder shows a Remove button', () => {
  const tree = create(<RemindersScreen />);
  const removes = tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === 'Remove'
  );
  expect(removes).toHaveLength(1);
});

const dialogVisible = (tree, testID) =>
  tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

test('Remove opens a confirm dialog; confirming drops the card', () => {
  const tree = create(<RemindersScreen />);
  // Dialog starts hidden and the custom reminder is present.
  expect(dialogVisible(tree, 'remove-dialog')).toBe(false);
  expect(texts(tree)).toContain('Check for better pods');

  press(tree, 'Remove'); // the card's remove button
  expect(dialogVisible(tree, 'remove-dialog')).toBe(true);
  expect(texts(tree)).toContain('Remove reminder?'); // dialog title
  expect(texts(tree)).toContain('Check for better pods'); // not gone yet

  press(tree, 'Remove reminder'); // the dialog's confirm action
  expect(dialogVisible(tree, 'remove-dialog')).toBe(false);
  expect(texts(tree)).not.toContain('Check for better pods');
});

test('pressing a detail row opens the value sheet', () => {
  const tree = create(<RemindersScreen />);
  expect(dialogVisible(tree, 'value-sheet')).toBe(false);
  press(tree, 'Watering Frequency'); // unique per-card detail-row label
  expect(dialogVisible(tree, 'value-sheet')).toBe(true);
});

test('confirming an edited frequency updates the shown value', () => {
  const tree = create(<RemindersScreen />);
  // Watering starts at "7 days".
  expect(texts(tree)).toContain('7 days');

  press(tree, 'Watering Frequency');
  // First wheel is the number column; drive it to index 0 (→ "1"), unit stays
  // "days" (index 0) → "1 day".
  const numberWheel = tree.root.findAllByType(WheelPicker)[0];
  act(() => numberWheel.props.onChange(0));
  press(tree, 'Set frequency'); // confirm

  expect(dialogVisible(tree, 'value-sheet')).toBe(false);
  expect(texts(tree)).toContain('1 day');
});
