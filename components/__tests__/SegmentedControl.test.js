import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import SegmentedControl from '../SegmentedControl';
import { SegmentedControl as BarrelSC } from '../index';
import { segmented } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

// Host tab nodes (resolved style + a11y state).
const tabs = (tree) =>
  tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tab'
  );
// Pressable composites (carry onPress) — one per segment, in order.
const pressTabs = (tree) =>
  tree.root.findAll(
    (n) =>
      n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function'
  );
const tabStyle = (t) => Object.assign({}, ...[].concat(t.props.style).filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelSC).toBe(SegmentedControl);
});

test('renders a labelled tab per segment (string or object)', () => {
  const tree = create(
    <SegmentedControl segments={['Day', { label: 'Week', value: 'w' }]} value="Day" />
  );
  expect(tree.root.findAllByType(Text).map((n) => n.props.children)).toEqual(
    expect.arrayContaining(['Day', 'Week'])
  );
  expect(tabs(tree)).toHaveLength(2);
});

test('the selected segment gets the white thumb and selected a11y', () => {
  const tree = create(
    <SegmentedControl segments={['Day', 'Week', 'Month']} value="Week" />
  );
  const week = tabs(tree)[1];
  expect(week.props.accessibilityState.selected).toBe(true);
  expect(tabStyle(week).backgroundColor).toBe(segmented.thumbBg);
  expect(tabStyle(tabs(tree)[0]).backgroundColor).toBeUndefined();
});

test('press reports the segment value and index', () => {
  const onChange = jest.fn();
  const tree = create(
    <SegmentedControl segments={['Day', 'Week']} value="Day" onChange={onChange} />
  );
  act(() => pressTabs(tree)[1].props.onPress());
  expect(onChange).toHaveBeenCalledWith('Week', 1);
});

test('disabled blocks changes', () => {
  const onChange = jest.fn();
  const tree = create(
    <SegmentedControl segments={['Day', 'Week']} value="Day" onChange={onChange} disabled />
  );
  act(() => pressTabs(tree)[1].props.onPress());
  expect(onChange).not.toHaveBeenCalled();
});
