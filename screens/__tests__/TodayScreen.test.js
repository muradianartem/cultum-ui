import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { State } from '../../components';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import TaskCard from '../TaskCard';
import TodayScreen from '../TodayScreen';

// Mid-afternoon, so "Good afternoon" is deterministic and a 09:00 reminder due
// today has already come due.
const NOW = new Date(2026, 8, 5, 15, 0, 0);

// The garden every test below reasons about: one task due today, one three days
// overdue, and one that isn't due for a few days.
const garden = () =>
  seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        room: 'Kitchen',
        reminders: [
          { action: 'water', intervalDays: 7, dueInDays: 0 },
          { action: 'fertilize', intervalDays: 30, dueInDays: -3 },
        ],
      },
      {
        nickname: 'Figgy',
        room: 'Bedroom',
        reminders: [
          { action: 'prune', title: 'Trim the aerial roots', intervalDays: 14, dueInDays: 4 },
        ],
      },
    ],
  });

const render = (state = garden()) => renderWithGarden(<TodayScreen />, { state, clock: NOW });

// Several cards are on screen — so reach the one whose task is named, then
// press within it.
const card = (r, title) =>
  r.tree.root.findAllByType(TaskCard).find((c) => c.props.task.title === title);

const pressIn = (node, label) =>
  act(() =>
    node
      .find((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label)
      .props.onPress(),
  );

afterEach(cleanupTrees);

test('greets by time of day, and by name once there is one', () => {
  expect(render().texts()).toContain('Good afternoon');
  expect(render({ ...garden(), profileName: 'Allison' }).texts()).toContain(
    'Good afternoon, Allison',
  );
});

test('the Today count is the number of tasks actually due', () => {
  const { tree, texts } = render();
  const t = texts();
  expect(t).toContain('Today');
  expect(t).toContain('Upcoming');
  expect(t).toContain('2'); // the watering due today + the overdue feeding

  expect(tree).toBeTruthy();
});

test('renders the section header and Complete All action', () => {
  const t = render().texts();
  expect(t).toContain('Today’s tasks');
  expect(t).toContain('Complete All');
});

test('groups by task type, and each row shows its plant, room and due badge', () => {
  const t = render().texts();
  expect(t).toContain('Watering'); // group header and row title
  expect(t).toContain('Fertilizing');
  expect(t).toContain('Penny · Kitchen');
  expect(t).toContain('Today');
  expect(t).toContain('3d ago');
});

test('each card carries a task-type badge on its photo', () => {
  const r = render();
  const badgeIcon = (title) =>
    card(r, title)
      .findAll((n) => n.props.accessibilityLabel && n.props.leftIcon)
      .map((n) => n.props.leftIcon.props.name)[0];
  expect(badgeIcon('Watering')).toBe('outlined-water');
  expect(badgeIcon('Fertilizing')).toBe('shovel');
});

test('a task not due today stays out of the day', () => {
  expect(render().texts()).not.toContain('Trim the aerial roots');
});

test('completing a task removes it, and an emptied group disappears', () => {
  const r = render();
  expect(r.texts()).toContain('Watering');

  pressIn(card(r, 'Watering'), 'Watering');
  r.press('Mark as done');

  expect(r.texts()).not.toContain('Watering'); // the row and its group header both go
  expect(r.texts()).toContain('Fertilizing'); // the other group remains
});

test('completing everything shows "All caught up" and previews what is next', () => {
  const { texts, press } = render();
  press('Complete All');
  press('Complete 2 tasks');

  const t = texts();
  expect(t).not.toContain('Fertilizing');
  expect(t).toContain('All caught up');
  expect(t).toContain('Your plants are on their own schedule.');
  expect(t).toContain('Next up');
  expect(t).toContain('Trim the aerial roots'); // the soonest upcoming task
  expect(t).not.toContain('Today’s tasks'); // nothing left to complete
  expect(t).not.toContain('Complete All');
});

test('"All caught up" fills the free space so Next up sits at the bottom', () => {
  const r = render();
  r.press('Complete All');
  r.press('Complete 2 tasks');

  const state = r.tree.root.findByType(State);
  expect(StyleSheet.flatten(state.props.style)).toMatchObject({
    flex: 1,
    justifyContent: 'center',
  });
});

test('an empty garden offers a way in rather than "all caught up"', () => {
  const t = render(seedGarden({ now: NOW })).texts();
  expect(t).toContain('No plants yet');
  expect(t).toContain('Add a plant');
  expect(t).not.toContain('Your plants are on their own schedule.');
  expect(t).not.toContain('Today’s tasks');
  expect(t).not.toContain('Complete All');
});

test('renders the 4-tab bar with Today active', () => {
  const { tree, texts, find } = render();
  ['Scan/Add', 'Rooms', 'Settings'].forEach((label) =>
    expect(texts()).toContain(label),
  );
  expect(texts()).not.toContain('Discover'); // hidden until V2
  expect(find('Today').props.accessibilityState.selected).toBe(true);
  expect(tree).toBeTruthy();
});

test('tapping the Scan/Add tab navigates to the camera route', () => {
  const r = render();
  r.press('Scan/Add');
  expect(r.router.route).toBe('scan-camera');
});

test('a task card opens that plant, not a hard-coded product page', () => {
  const state = garden();
  const r = render(state);
  pressIn(card(r, 'Watering'), 'Watering'); // the card body opens the detail sheet
  r.press('Open plant page');
  expect(r.router.route).toBe('product');
  expect(r.router.params.plantId).toBe(state.plants[0].id);
});

test('tapping the "Next up" preview opens that plant', () => {
  const state = garden();
  const r = render(state);
  r.press('Complete All');
  r.press('Complete 2 tasks');
  pressIn(card(r, 'Trim the aerial roots'), 'Trim the aerial roots');
  expect(r.router.route).toBe('product');
  expect(r.router.params.plantId).toBe(state.plants[1].id); // Figgy
});

test('snoozing a task moves it out of today without changing its cadence', () => {
  const r = render();
  pressIn(card(r, 'Watering'), 'Watering');
  r.press('Snooze for');
  // SnoozeContent opens on "2 days"; its CTA carries the choice.
  r.press('Snooze for 2 days');

  expect(r.texts()).not.toContain('Watering');
});

describe('the snoozed banner', () => {
  test('is hidden while nothing is snoozed', () => {
    expect(render().texts().join(' ')).not.toMatch(/snoozed/);
  });

  test('appears once a task is snoozed, and opens the Snoozed page', () => {
    const r = render();
    pressIn(card(r, 'Watering'), 'Watering');
    r.press('Snooze for');
    r.press('Snooze for 2 days');
    expect(r.texts()).toContain('1 task snoozed');

    r.press('1 task snoozed');
    expect(r.router.route).toBe('snoozed');
  });

  test('still shows on the "All caught up" state', () => {
    const r = render();
    pressIn(card(r, 'Watering'), 'Watering');
    r.press('Snooze for');
    r.press('Snooze for 2 days');
    pressIn(card(r, 'Fertilizing'), 'Fertilizing');
    r.press('Snooze for');
    r.press('Snooze for 2 days');
    expect(r.texts()).toContain('2 tasks snoozed');
  });
});

describe('the snackbar takes the action back', () => {
  test('completing one task', () => {
    const r = render();
    pressIn(card(r, 'Watering'), 'Watering');
    r.press('Mark as done');
    expect(r.texts()).toContain('Task completed');

    r.press('Undo');
    expect(r.texts()).toContain('Watering');
    expect(r.texts()).not.toContain('Task completed');
  });

  test('completing all of them', () => {
    const r = render();
    r.press('Complete All');
    r.press('Complete 2 tasks');
    expect(r.texts()).toContain('All 2 tasks completed');

    r.press('Undo');
    const t = r.texts();
    expect(t).toContain('Watering');
    expect(t).toContain('Fertilizing');
    expect(t).not.toContain('All caught up');
  });

  test('snoozing', () => {
    const r = render();
    pressIn(card(r, 'Watering'), 'Watering');
    r.press('Snooze for');
    r.press('Snooze for 2 days');
    expect(r.texts()).toContain('Snoozed for 2 days');

    r.press('Undo');
    expect(r.texts()).toContain('Watering');
  });
});
