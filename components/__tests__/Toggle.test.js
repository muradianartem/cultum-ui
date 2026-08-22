import TestRenderer, { act } from 'react-test-renderer';
import Toggle from '../Toggle';
import { Toggle as BarrelToggle } from '../index';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const sw = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'switch'
  );

// The element carrying the press handler (Pressable resolves to a host node).
const press = (tree) =>
  tree.root.find((n) => typeof n.props.onPress === 'function').props.onPress();

test('is exported from the components barrel', () => {
  expect(BarrelToggle).toBe(Toggle);
});

test('reflects value in accessibility state', () => {
  expect(sw(create(<Toggle value />)).props.accessibilityState.checked).toBe(true);
  expect(sw(create(<Toggle value={false} />)).props.accessibilityState.checked).toBe(false);
});

test('press requests the opposite value', () => {
  const onChange = jest.fn();
  const tree = create(<Toggle value={false} onValueChange={onChange} />);
  act(() => press(tree));
  expect(onChange).toHaveBeenCalledWith(true);
});

test('disabled blocks changes', () => {
  const onChange = jest.fn();
  const tree = create(<Toggle value onValueChange={onChange} disabled />);
  act(() => press(tree));
  expect(onChange).not.toHaveBeenCalled();
  expect(sw(tree).props.accessibilityState.disabled).toBe(true);
});
