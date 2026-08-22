import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import TabBar from '../TabBar';
import { TabBar as BarrelTabBar } from '../index';
import { tabBar as tk } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const TABS = [
  { value: 'home', label: 'Home', icon: <Text>🏠</Text> },
  { value: 'plants', label: 'Plants', icon: <Text>🪴</Text> },
  { value: 'add', label: 'Add', icon: <Text>＋</Text>, emphasized: true },
];

const hostTabs = (tree) =>
  tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tab'
  );
const pressTabs = (tree) =>
  tree.root.findAll(
    (n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function'
  );

test('is exported from the components barrel', () => {
  expect(BarrelTabBar).toBe(TabBar);
});

test('renders a labelled tab per entry', () => {
  const tree = create(<TabBar tabs={TABS} value="home" />);
  const labels = tree.root.findAllByType(Text).map((n) => n.props.children);
  expect(labels).toEqual(expect.arrayContaining(['Home', 'Plants', 'Add']));
  expect(hostTabs(tree)).toHaveLength(3);
});

test('marks the active tab selected', () => {
  const tree = create(<TabBar tabs={TABS} value="plants" />);
  expect(hostTabs(tree)[1].props.accessibilityState.selected).toBe(true);
  expect(hostTabs(tree)[0].props.accessibilityState.selected).toBe(false);
});

test('press reports the tab value', () => {
  const onChange = jest.fn();
  const tree = create(<TabBar tabs={TABS} value="home" onChange={onChange} />);
  act(() => pressTabs(tree)[1].props.onPress());
  expect(onChange).toHaveBeenCalledWith('plants');
});

test('disabled tab does not fire', () => {
  const onChange = jest.fn();
  const tabs = [TABS[0], { ...TABS[1], disabled: true }];
  const tree = create(<TabBar tabs={tabs} value="home" onChange={onChange} />);
  act(() => pressTabs(tree)[1].props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  expect(hostTabs(tree)[1].props.accessibilityState.disabled).toBe(true);
});
