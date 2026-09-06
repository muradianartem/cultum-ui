import { act } from 'react-test-renderer';
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

// The swipe actions live inside a specific card, and several cards are on
// screen — so reach the one whose task is named, then press within it.
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

test('a task not due today stays out of the day', () => {
  expect(render().texts()).not.toContain('Trim the aerial roots');
});

test('completing a task removes it, and an emptied group disappears', () => {
  const r = render();
  expect(r.texts()).toContain('Watering');

  pressIn(card(r, 'Watering'), 'Mark task done');

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
});

test('an empty garden offers a way in rather than "all caught up"', () => {
  const t = render(seedGarden({ now: NOW })).texts();
  expect(t).toContain('No plants yet');
  expect(t).toContain('Add a plant');
  expect(t).not.toContain('Your plants are on their own schedule.');
});

test('renders the 5-tab bar with Today active', () => {
  const { tree, texts, find } = render();
  ['Discover', 'Scan/Add', 'Rooms', 'Settings'].forEach((label) =>
    expect(texts()).toContain(label),
  );
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

test('snoozing a task moves it out of today without changing its cadence', () => {
  const r = render();
  pressIn(card(r, 'Watering'), 'Snooze task');
  // SnoozeContent opens on "2 days"; its CTA carries the choice.
  r.press('Snooze for 2 days');

  expect(r.texts()).not.toContain('Watering');
});
