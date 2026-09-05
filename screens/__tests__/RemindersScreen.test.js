import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../routing';
import { WheelPicker } from '../../components';
import RemindersScreen from '../RemindersScreen';
import { monthLabel } from '../../components/Calendar';
import { parseShortDate } from '../addReminderData';

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

test('renders the three reminder titles and the Add new reminder row', () => {
  const tree = create(<RemindersScreen />);
  const t = texts(tree);
  expect(t).toContain('Watering');
  expect(t).toContain('Fertilizing');
  expect(t).toContain('Check for better pods');
  expect(t).toContain('Add new reminder');
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
  // First wheel is the number column; drive it to index 0 (→ "1"). The unit
  // wheel stays where "7 days" seeded it — "days", index 1 of the shared
  // FREQUENCY_UNITS — giving "1 day".
  const numberWheel = tree.root.findAllByType(WheelPicker)[0];
  act(() => numberWheel.props.onChange(0));
  press(tree, 'Set frequency'); // confirm

  expect(dialogVisible(tree, 'value-sheet')).toBe(false);
  expect(texts(tree)).toContain('1 day');
});

// ---- the "Add new reminder" flow (screens/AddReminderSheet.js) ----

const sheetVisible = (tree, testID) =>
  tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

// Press the deepest node carrying this label — Button/ButtonIcon elements hold
// the prop too, and only the host Pressable should be driven.
const pressDeep = (tree, label) => {
  const nodes = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label
  );
  act(() => nodes[nodes.length - 1].props.onPress());
};

test('the nav bar + opens the add-reminder sheet', () => {
  const tree = create(<RemindersScreen />);
  expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(false);
  pressDeep(tree, 'Add reminder'); // the icon-only nav action
  expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(true);
});

test('the bottom row opens the same sheet', () => {
  const tree = create(<RemindersScreen />);
  pressDeep(tree, 'Add new reminder');
  expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(true);
});

test('completing the flow appends a card and closes the sheet', () => {
  const tree = create(<RemindersScreen />);
  expect(texts(tree)).not.toContain('Rotate the pot');

  pressDeep(tree, 'Add reminder');
  act(() =>
    tree.root.findByType(RNTextInput).props.onChangeText('Rotate the pot')
  );
  pressDeep(tree, 'Continue');
  pressDeep(tree, 'Remind every 2 days');

  expect(sheetVisible(tree, 'add-reminder-sheet')).toBe(false);
  const t = texts(tree);
  expect(t).toContain('Rotate the pot');
  expect(t).toContain('2 days'); // its frequency detail row
  // It arrives enabled and removable: a 4th toggle and a 2nd Remove button.
  expect(switches(tree)).toHaveLength(4);
  expect(switches(tree)[3].props.accessibilityState.checked).toBe(true);
  expect(
    tree.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === 'Remove'
    )
  ).toHaveLength(2);
});

test('a new reminder is immediately editable by the value sheet', () => {
  const tree = create(<RemindersScreen />);
  pressDeep(tree, 'Add reminder');
  act(() =>
    tree.root.findByType(RNTextInput).props.onChangeText('Rotate the pot')
  );
  pressDeep(tree, 'Continue');
  pressDeep(tree, 'Remind every 2 days');

  // The frequency it was created with seeds the wheel, so confirming without
  // touching anything round-trips the same value.
  press(tree, 'Rotate the pot Frequency');
  expect(sheetVisible(tree, 'value-sheet')).toBe(true);
  press(tree, 'Set frequency');
  expect(texts(tree)).toContain('2 days');
});

// ---- the date row uses the same calendar as the create flow ----

test('a date row opens a calendar, not a wheel', () => {
  const tree = create(<RemindersScreen />);
  press(tree, 'Watering date');
  expect(sheetVisible(tree, 'value-sheet')).toBe(true);

  const seeded = parseShortDate('21 Aug', new Date()); // the seeded value
  const t = texts(tree);
  expect(t).toContain(monthLabel(seeded)); // the calendar's month header
  expect(t).toContain('Set 21 Aug'); // CTA reflects the current value
  expect(t).toContain('Two weeks ago'); // the shared suggestion chips
  // Nothing on screen is a wheel any more while a date is being picked.
  expect(tree.root.findAllByType(WheelPicker)).toHaveLength(0);
});

test('picking a day on the calendar writes it back to the row', () => {
  const tree = create(<RemindersScreen />);
  expect(texts(tree)).not.toContain('15 Aug');

  press(tree, 'Watering date');
  const seeded = parseShortDate('21 Aug', new Date());
  pressDeep(tree, `15 ${monthLabel(seeded)}`); // e.g. "15 August 2026"
  pressDeep(tree, 'Set 15 Aug');

  expect(sheetVisible(tree, 'value-sheet')).toBe(false);
  expect(texts(tree)).toContain('15 Aug');
});

test('the sheet is titled by what the row holds', () => {
  const tree = create(<RemindersScreen />);
  // The custom reminder's date row is a "Start date"; the built-ins are
  // "Last watering" / "Last fertilizing".
  press(tree, 'Check for better pods date');
  const titles = tree.root
    .findAll((n) => n.props.testID === 'value-sheet')[0]
    .findAllByType(Text)
    .flatMap((n) => [].concat(n.props.children));
  expect(titles).toContain('Start date');
});
