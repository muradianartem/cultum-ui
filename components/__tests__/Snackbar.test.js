import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Snackbar from '../Snackbar';
import { Snackbar as BarrelSnackbar } from '../index';
import { snackbar } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
// Match the element that owns both the label and the press handler (the
// Pressable composite; the host node it resolves to has no onPress).
const byLabel = (tree, label) =>
  tree.root.find(
    (n) =>
      n.props.accessibilityLabel === label && typeof n.props.onPress === 'function'
  );

test('is exported from the components barrel', () => {
  expect(BarrelSnackbar).toBe(Snackbar);
});

test('renders its copy as an alert with the dark surface', () => {
  const tree = create(<Snackbar label="Saved" />);
  expect(texts(tree)).toContain('Saved');
  const bar = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'alert'
  );
  const s = Object.assign({}, ...[].concat(bar.props.style).filter(Boolean));
  expect(s.backgroundColor).toBe(snackbar.bg);
});

test('action renders and fires', () => {
  const onPress = jest.fn();
  const tree = create(<Snackbar label="Deleted" action={{ label: 'Undo', onPress }} />);
  expect(texts(tree)).toContain('Undo');
  act(() => byLabel(tree, 'Undo').props.onPress());
  expect(onPress).toHaveBeenCalled();
});

test('onDismiss renders a close control that fires', () => {
  const onDismiss = jest.fn();
  const tree = create(<Snackbar label="x" onDismiss={onDismiss} />);
  act(() => byLabel(tree, 'Dismiss').props.onPress());
  expect(onDismiss).toHaveBeenCalled();
});

test('no action / no dismiss when not provided', () => {
  const tree = create(<Snackbar label="x" />);
  expect(() => byLabel(tree, 'Dismiss')).toThrow();
});
