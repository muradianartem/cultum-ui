import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import Chip from '../Chip';
import { Chip as BarrelChip } from '../index';
import { chip } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const node = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button'
  );
const nodeStyle = (tree) =>
  Object.assign({}, ...[].concat(node(tree).props.style).filter(Boolean));
// Nodes carrying onPress: the Chip element (raw prop) and the inner Pressable
// wrapper (which enforces `disabled`). The deepest match is the wrapper.
const press = (tree) => {
  const nodes = tree.root.findAll((n) => typeof n.props.onPress === 'function');
  nodes[nodes.length - 1].props.onPress();
};

test('is exported from the components barrel', () => {
  expect(BarrelChip).toBe(Chip);
});

test('renders its label', () => {
  expect(create(<Chip label="Indoor" />).root.findByType(Text).props.children).toBe('Indoor');
});

test('enabled uses the base fill and dark ink', () => {
  const tree = create(<Chip label="x" />);
  expect(nodeStyle(tree).backgroundColor).toBe(chip.bg);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: chip.ink })])
  );
});

test('selected darkens the fill and ink', () => {
  const tree = create(<Chip label="x" selected />);
  expect(nodeStyle(tree).backgroundColor).toBe(chip.bgSelected);
  expect(node(tree).props.accessibilityState.selected).toBe(true);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: chip.inkSelected })])
  );
});

test('leftIcon switches to the icon padding and renders the node', () => {
  const tree = create(<Chip label="x" leftIcon={<View testID="ic" />} />);
  expect(nodeStyle(tree).paddingLeft).toBe(4);
  expect(
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'ic')
  ).toHaveLength(1);
});

test('press fires; disabled blocks it', () => {
  const onPress = jest.fn();
  const on = create(<Chip label="x" onPress={onPress} />);
  act(() => press(on));
  expect(onPress).toHaveBeenCalledTimes(1);

  const off = create(<Chip label="x" onPress={onPress} disabled />);
  act(() => press(off));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(nodeStyle(off).backgroundColor).toBe(chip.bgDisabled);
});
