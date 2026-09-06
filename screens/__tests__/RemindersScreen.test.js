import { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { WheelPicker } from '../../components';
import { monthLabel } from '../../components/Calendar';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import RemindersScreen from '../RemindersScreen';

const NOW = new Date(2026, 8, 5, 15, 0, 0);

// One plant with the three shapes a reminder comes in: a watering that has been
// done (so its date row is anchored to the last time), a fertilizing, and a
// custom one the user made and can rename or remove.
const garden = () =>
  seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        room: 'Kitchen',
        reminders: [
          {
            action: 'water',
            intervalDays: 7,
            overrides: { lastDoneAt: new Date(2026, 7, 21, 9, 0).toISOString() },
          },
          { action: 'fertilize', intervalDays: 30, dueInDays: 2 },
          {
            action: 'custom',
            title: 'Check for better pods',
            intervalDays: 7,
            enabled: false,
            dueInDays: 3,
          },
        ],
      },
    ],
  });

const render = (state = garden()) =>
  renderWithGarden(<RemindersScreen plantId={state.plants[0].id} />, {
    state,
    initial: 'reminders',
    clock: NOW,
  });

afterEach(cleanupTrees);

// Every Toggle renders a host node with accessibilityRole="switch".
const switches = (r) =>
  r.tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'switch',
  );

const visible = (r, testID) =>
  r.tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

const removeButtons = (r) =>
  r.tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === 'Remove',
  );

test('renders this plant\'s reminders, under its name', () => {
  const r = render();
  const t = r.texts();
  expect(t).toContain('Edit Reminders');
  expect(t).toContain('Penny'); // the nav subtitle is the plant, not a fixture
  expect(t).toContain('Watering');
  expect(t).toContain('Fertilizing');
  expect(t).toContain('Check for better pods');
  expect(t).toContain('Add new reminder');
});

test('opened without a plant it says so rather than showing someone else\'s', () => {
  const t = renderWithGarden(<RemindersScreen />, {
    state: garden(),
    initial: 'reminders',
    clock: NOW,
  }).texts();
  expect(t).toContain('No plant selected');
});

test('one enable toggle per reminder, reflecting what is actually on', () => {
  const r = render();
  expect(switches(r)).toHaveLength(3);
  expect(switches(r).map((n) => n.props.accessibilityState.checked)).toEqual([
    true,
    true,
    false,
  ]);
});

test('pressing a toggle flips it, and it stays flipped in the store', () => {
  const r = render();
  expect(switches(r)[2].props.accessibilityState.checked).toBe(false);
  r.press('Enable Check for better pods');
  expect(switches(r)[2].props.accessibilityState.checked).toBe(true);
});

test('each card shows its detail rows, anchored to what the reminder knows', () => {
  const t = render().texts();
  expect(t).toContain('Last watering'); // it has been done
  expect(t).toContain('21 Aug');
  expect(t).toContain('Start date'); // the others have not
  expect(t).toContain('Frequency');
  expect(t).toContain('7 days');
  expect(t).toContain('Snooze for');
  expect(t).toContain('None');
});

test('an enabled reminder shows when it next comes round', () => {
  // 21 Aug + 7 days.
  expect(render().texts()).toContain('Next reminder: Fri, Aug 28');
});

test('every reminder can be removed — none of them is special', () => {
  expect(removeButtons(render())).toHaveLength(3);
});

test('Remove opens a confirm dialog; confirming drops the card', () => {
  const r = render();
  expect(visible(r, 'remove-dialog')).toBe(false);
  expect(r.texts()).toContain('Check for better pods');

  // The last card's Remove button.
  act(() => removeButtons(r)[2].props.onPress());
  expect(visible(r, 'remove-dialog')).toBe(true);
  expect(r.texts()).toContain('Remove reminder?');
  expect(r.texts()).toContain('Check for better pods'); // not gone yet

  r.press('Remove reminder');
  expect(visible(r, 'remove-dialog')).toBe(false);
  expect(r.texts()).not.toContain('Check for better pods');
});

test('pressing a detail row opens the value sheet', () => {
  const r = render();
  expect(visible(r, 'value-sheet')).toBe(false);
  r.press('Watering Frequency');
  expect(visible(r, 'value-sheet')).toBe(true);
});

test('an edited frequency is stored as an interval, and re-read as one', () => {
  const r = render();
  expect(r.texts()).toContain('7 days');

  r.press('Watering Frequency');
  // First wheel is the number column; drive it to index 0 (→ "1"). The unit
  // wheel stays where "7 days" seeded it — "days", index 1 of the shared
  // FREQUENCY_UNITS — giving "1 day".
  act(() => r.tree.root.findAllByType(WheelPicker)[0].props.onChange(0));
  r.press('Set frequency');

  expect(visible(r, 'value-sheet')).toBe(false);
  expect(r.texts()).toContain('1 day');
  // And the schedule moves with it: 21 Aug + 1 day.
  expect(r.texts()).toContain('Next reminder: Sat, Aug 22');
});

test('a snooze pushes the reminder out and the row says until when', () => {
  const r = render();
  r.press('Watering Snooze');
  // On "None" the sheet hides the number column, so the only wheel is the unit
  // one; picking 'days' (index 2 of [None, hours, days, …]) brings the number
  // column back at its default of 1.
  act(() => r.tree.root.findAllByType(WheelPicker)[0].props.onChange(2));
  r.press('Set snooze');
  expect(r.texts()).toContain('Until 6 Sep'); // 5 Sep + 1 day
});

// ---- the "Add new reminder" flow (screens/AddReminderSheet.js) ----

test('the nav bar + and the bottom row both open the add-reminder sheet', () => {
  const r = render();
  expect(visible(r, 'add-reminder-sheet')).toBe(false);
  r.press('Add reminder');
  expect(visible(r, 'add-reminder-sheet')).toBe(true);

  const r2 = render();
  r2.press('Add new reminder');
  expect(visible(r2, 'add-reminder-sheet')).toBe(true);
});

const addReminder = (r, title) => {
  r.press('Add reminder');
  act(() => r.tree.root.findByType(RNTextInput).props.onChangeText(title));
  r.press('Continue');
  r.press('Remind every 2 days');
};

test('completing the flow appends a real reminder and closes the sheet', () => {
  const r = render();
  expect(r.texts()).not.toContain('Rotate the pot');

  addReminder(r, 'Rotate the pot');

  expect(visible(r, 'add-reminder-sheet')).toBe(false);
  expect(r.texts()).toContain('Rotate the pot');
  expect(r.texts()).toContain('2 days'); // its frequency detail row
  // It arrives enabled: a 4th toggle, checked.
  expect(switches(r)).toHaveLength(4);
  expect(switches(r)[3].props.accessibilityState.checked).toBe(true);
  expect(removeButtons(r)).toHaveLength(4);
});

test('a new reminder is immediately editable by the value sheet', () => {
  const r = render();
  addReminder(r, 'Rotate the pot');

  // The frequency it was created with seeds the wheel, so confirming without
  // touching anything round-trips the same value.
  r.press('Rotate the pot Frequency');
  expect(visible(r, 'value-sheet')).toBe(true);
  r.press('Set frequency');
  expect(r.texts()).toContain('2 days');
});

// ---- the date row uses the same calendar as the create flow ----

test('a date row opens a calendar, not a wheel', () => {
  const r = render();
  r.press('Watering date');
  expect(visible(r, 'value-sheet')).toBe(true);

  const seeded = new Date(2026, 7, 21);
  const t = r.texts();
  expect(t).toContain(monthLabel(seeded)); // the calendar's month header
  expect(t).toContain('Set 21 Aug'); // CTA reflects the current value
  expect(t).toContain('Two weeks ago'); // the shared suggestion chips
  // Nothing on screen is a wheel any more while a date is being picked.
  expect(r.tree.root.findAllByType(WheelPicker)).toHaveLength(0);
});

test('picking a day writes it back and moves the schedule with it', () => {
  const r = render();
  expect(r.texts()).not.toContain('15 Aug');

  r.press('Watering date');
  const seeded = new Date(2026, 7, 21);
  r.press(`15 ${monthLabel(seeded)}`); // e.g. "15 August 2026"
  r.press('Set 15 Aug');

  expect(visible(r, 'value-sheet')).toBe(false);
  expect(r.texts()).toContain('15 Aug');
  expect(r.texts()).toContain('Next reminder: Sat, Aug 22');
});

test('the sheet is titled by what the row holds', () => {
  const r = render();
  r.press('Check for better pods date');
  const titles = r.tree.root
    .findAll((n) => n.props.testID === 'value-sheet')[0]
    .findAllByType(Text)
    .flatMap((n) => [].concat(n.props.children));
  expect(titles).toContain('Start date');
});
