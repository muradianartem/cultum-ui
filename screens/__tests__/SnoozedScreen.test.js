import { act } from 'react-test-renderer';
import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import SnoozedScreen from '../SnoozedScreen';
import TaskCard from '../TaskCard';

const NOW = new Date(2026, 8, 5, 15, 0, 0);
const inDays = (n) => new Date(2026, 8, 5 + n, 15, 0, 0).toISOString();

// Penny's watering was due today but is snoozed three days; her feeding is
// snoozed a week. Figgy's pruning is simply due in four days — not snoozed.
const garden = () =>
  seedGarden({
    now: NOW,
    plants: [
      {
        nickname: 'Penny',
        room: 'Kitchen',
        reminders: [
          { action: 'water', intervalDays: 7, dueInDays: 0, overrides: { snoozedUntil: inDays(3) } },
          { action: 'fertilize', intervalDays: 30, dueInDays: -1, overrides: { snoozedUntil: inDays(7) } },
        ],
      },
      {
        nickname: 'Figgy',
        room: 'Bedroom',
        reminders: [{ action: 'prune', intervalDays: 14, dueInDays: 4 }],
      },
    ],
  });

const render = () =>
  renderWithGarden(<SnoozedScreen />, { state: garden(), clock: NOW, initial: 'snoozed' });

const open = (r, title) =>
  act(() =>
    r.tree.root.findAllByType(TaskCard).find((c) => c.props.task.title === title).props.onPress(),
  );

afterEach(cleanupTrees);

test('lists only the snoozed tasks, soonest first, with a count', () => {
  const r = render();
  const titles = r.tree.root.findAllByType(TaskCard).map((c) => c.props.task.title);
  expect(titles).toEqual(['Watering', 'Fertilizing']);
  const t = r.texts();
  expect(t).toContain('Snoozed');
  expect(t).toContain('2 tasks');
  expect(t).toContain('In 3d');
  expect(t).toContain('In 7d');
});

test('the sheet shows the snoozed variant', () => {
  const r = render();
  open(r, 'Watering');
  const t = r.texts();
  expect(t).toContain('Snoozed · In 3d');
  expect(t).toContain('Cancel snooze');
  expect(t).not.toContain('Snooze for');
});

test('cancelling a snooze takes the task off the page', () => {
  const r = render();
  open(r, 'Watering');
  r.press('Cancel snooze');
  const titles = r.tree.root.findAllByType(TaskCard).map((c) => c.props.task.title);
  expect(titles).toEqual(['Fertilizing']);
  expect(r.texts()).toContain('1 task');
  expect(r.texts()).toContain('Snooze cancelled');
});

test('an emptied page says so', () => {
  const r = render();
  open(r, 'Watering');
  r.press('Cancel snooze');
  open(r, 'Fertilizing');
  r.press('Cancel snooze');
  expect(r.texts()).toContain('Nothing snoozed');
  expect(r.texts()).toContain('0 tasks');
});
