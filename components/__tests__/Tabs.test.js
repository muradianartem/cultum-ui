import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Tabs from '../Tabs';
import { Tabs as BarrelTabs } from '../index';
import { tabs as tk } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'care', label: 'Care' },
  { value: 'notes', label: 'Notes', disabled: true },
];

const hostTabs = (tree) =>
  tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tab'
  );
const pressTabs = (tree) =>
  tree.root.findAll(
    (n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function'
  );
const style = (t) => Object.assign({}, ...[].concat(t.props.style).flat().filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelTabs).toBe(Tabs);
});

test('renders a labelled tab per item', () => {
  const tree = create(<Tabs items={ITEMS} value="overview" />);
  const labels = tree.root.findAllByType(Text).map((n) => n.props.children);
  expect(labels).toEqual(expect.arrayContaining(['Overview', 'Care', 'Notes']));
  expect(hostTabs(tree)).toHaveLength(3);
});

test('the active tab gets the green underline; others are transparent', () => {
  const tree = create(<Tabs items={ITEMS} value="care" />);
  expect(style(hostTabs(tree)[1]).borderBottomColor).toBe(tk.underline);
  expect(style(hostTabs(tree)[0]).borderBottomColor).toBe('transparent');
  expect(hostTabs(tree)[1].props.accessibilityState.selected).toBe(true);
});

test('press reports the tab value', () => {
  const onChange = jest.fn();
  const tree = create(<Tabs items={ITEMS} value="overview" onChange={onChange} />);
  act(() => pressTabs(tree)[1].props.onPress());
  expect(onChange).toHaveBeenCalledWith('care');
});

test('disabled tab does not fire', () => {
  const onChange = jest.fn();
  const tree = create(<Tabs items={ITEMS} value="overview" onChange={onChange} />);
  act(() => pressTabs(tree)[2].props.onPress());
  expect(onChange).not.toHaveBeenCalled();
  expect(hostTabs(tree)[2].props.accessibilityState.disabled).toBe(true);
});
