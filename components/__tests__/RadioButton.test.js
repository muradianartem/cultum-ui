import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import RadioButton from '../RadioButton';
import { RadioButton as BarrelRadio } from '../index';
import { radio } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const radioNode = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'radio'
  );
const press = (tree) =>
  tree.root.find((n) => typeof n.props.onPress === 'function').props.onPress();

// The inner dot = a View with a background matching the dot colour.
const hasDot = (tree) =>
  tree.root
    .findAll((n) => typeof n.type === 'string' && n.type === 'View')
    .some((v) => {
      const s = Object.assign({}, ...[].concat(v.props.style).filter(Boolean));
      return s.backgroundColor === radio.dot || s.backgroundColor === radio.dotDisabled;
    });

test('is exported from the components barrel', () => {
  expect(BarrelRadio).toBe(RadioButton);
});

test('unselected shows no dot', () => {
  expect(hasDot(create(<RadioButton />))).toBe(false);
});

test('selected shows a dot and reports selected to a11y', () => {
  const tree = create(<RadioButton selected />);
  expect(hasDot(tree)).toBe(true);
  expect(radioNode(tree).props.accessibilityState.selected).toBe(true);
});

test('press reports its value', () => {
  const onSelect = jest.fn();
  const tree = create(<RadioButton value="a" onSelect={onSelect} />);
  act(() => press(tree));
  expect(onSelect).toHaveBeenCalledWith('a');
});

test('disabled blocks selection', () => {
  const onSelect = jest.fn();
  const tree = create(<RadioButton value="a" onSelect={onSelect} disabled />);
  act(() => press(tree));
  expect(onSelect).not.toHaveBeenCalled();
  expect(radioNode(tree).props.accessibilityState.disabled).toBe(true);
});
