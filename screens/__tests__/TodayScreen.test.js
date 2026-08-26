import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TodayScreen from '../TodayScreen';

// Insets need a provider; feed fixed metrics so useSafeAreaInsets resolves.
const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>{el}</SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// Flattened text content within a node's subtree.
const subtreeText = (node) =>
  node.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

const tabs = (tree) =>
  tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tab'
  );

test('renders the greeting', () => {
  const tree = create(<TodayScreen />);
  expect(texts(tree)).toContain('Good afternoon, Allison');
});

test('renders the segmented control with a Today count, Today selected', () => {
  const tree = create(<TodayScreen />);
  const t = texts(tree);
  expect(t).toContain('Today');
  expect(t).toContain('Upcoming');
  expect(t).toContain('5'); // green count badge on Today

  const todayTab = tabs(tree).find((n) => subtreeText(n).includes('Today'));
  expect(todayTab).toBeTruthy();
  expect(todayTab.props.accessibilityState.selected).toBe(true);
});

test('renders the section header and Complete All action', () => {
  const tree = create(<TodayScreen />);
  const t = texts(tree);
  expect(t).toContain('Today’s tasks');
  expect(t).toContain('Complete All');
});

test('renders the three task groups with their rows', () => {
  const tree = create(<TodayScreen />);
  const t = texts(tree);
  expect(t).toContain('Watering');
  expect(t).toContain('Fertilizing');
  expect(t).toContain('Custom');
  expect(t).toContain('Soil Check'); // a Watering row title
  expect(t).toContain('Move this plant'); // the Custom row title
});

test('each task row shows a "plant · room" subtitle and a due badge', () => {
  const tree = create(<TodayScreen />);
  const t = texts(tree);
  expect(t).toContain('Monstera · Kitchen'); // subtitle for Soil Check
  expect(t).toContain('3d ago'); // a due badge label
  expect(t).toContain('2d ago'); // a due badge label
});

// Fire the deepest onPress for the row whose accessible label matches.
const pressRow = (tree, label) => {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label
  );
  act(() => node.props.onPress());
};

test('completing a task removes it, and an emptied group disappears', () => {
  const tree = create(<TodayScreen />);
  expect(texts(tree)).toContain('Soil Check');
  expect(texts(tree)).toContain('Watering');

  pressRow(tree, 'Soil Check');

  const t = texts(tree);
  expect(t).not.toContain('Soil Check'); // the only Watering task is gone
  expect(t).not.toContain('Watering'); // so the group header drops too
  expect(t).toContain('Move this plant'); // other groups remain
});

test('completing all tasks shows the "All caught up" and "Next up" block', () => {
  const tree = create(<TodayScreen />);
  pressRow(tree, 'Complete All');

  const t = texts(tree);
  expect(t).not.toContain('Soil Check'); // every group is gone
  expect(t).toContain('All caught up');
  expect(t).toContain('Your plants are on their own schedule.');
  expect(t).toContain('Next up');
  expect(t).toContain('Mist leaves'); // the Next up task title
});

test('renders the 5-tab bar with Today active', () => {
  const tree = create(<TodayScreen />);
  const t = texts(tree);
  ['Discover', 'Scan/Add', 'Rooms', 'Settings'].forEach((label) =>
    expect(t).toContain(label)
  );

  // The tab bar's Today tab has a plain string accessibilityLabel (the segment's
  // Today label is a node), and it is the selected tab.
  const todayTab = tabs(tree).find((n) => n.props.accessibilityLabel === 'Today');
  expect(todayTab).toBeTruthy();
  expect(todayTab.props.accessibilityState.selected).toBe(true);
});
