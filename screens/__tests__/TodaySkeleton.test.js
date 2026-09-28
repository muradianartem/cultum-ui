import { cleanupTrees, renderWithGarden, seedGarden } from '../../store/testing';
import TodaySkeleton from '../TodaySkeleton';
import { TABS } from '../navConfig';

const NOW = new Date(2026, 8, 5, 15, 0, 0);

const render = (state = seedGarden({ now: NOW })) =>
  renderWithGarden(<TodaySkeleton />, { state, clock: NOW });

afterEach(cleanupTrees);

test('keeps the real greeting, segments and tab bar around the placeholders', () => {
  const texts = render({ ...seedGarden({ now: NOW }), profileName: 'Allison' }).texts();
  expect(texts).toContain('Good afternoon, Allison');
  expect(texts).toContain('Today');
  expect(texts).toContain('Upcoming');
  for (const tab of TABS) expect(texts).toContain(tab.label);
  // No task copy, and none of Today's list-only controls.
  expect(texts).not.toContain('Today’s tasks');
  expect(texts).not.toContain('Complete All');
});

test('draws three groups of placeholder cards, 2 + 2 + 1', () => {
  const { tree } = render();
  const cards = tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.testID === 'skeleton-task-card'
  );
  expect(cards).toHaveLength(5);
});

test('announces loading once, for the whole list', () => {
  const { tree } = render();
  const loaders = tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'progressbar'
  );
  expect(loaders).toHaveLength(1);
  expect(loaders[0].props.accessibilityLabel).toBe('Loading your garden');
});
