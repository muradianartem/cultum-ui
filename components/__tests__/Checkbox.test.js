import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Checkbox from '../Checkbox';
import { Checkbox as BarrelCheckbox } from '../index';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const box = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'checkbox'
  );
const press = (tree) =>
  tree.root.find((n) => typeof n.props.onPress === 'function').props.onPress();
const glyph = (tree) => {
  const t = tree.root.findAllByType(Text);
  return t.length ? t[0].props.children : null;
};

test('is exported from the components barrel', () => {
  expect(BarrelCheckbox).toBe(Checkbox);
});

test('unchecked shows no glyph', () => {
  expect(glyph(create(<Checkbox />))).toBeNull();
});

test('checked shows a check and reports checked to a11y', () => {
  const tree = create(<Checkbox checked />);
  expect(glyph(tree)).toBe('✓');
  expect(box(tree).props.accessibilityState.checked).toBe(true);
});

test('indeterminate shows a dash and reports mixed', () => {
  const tree = create(<Checkbox indeterminate />);
  expect(glyph(tree)).toBe('–');
  expect(box(tree).props.accessibilityState.checked).toBe('mixed');
});

test('press toggles from the checked value', () => {
  const onChange = jest.fn();
  const tree = create(<Checkbox checked onChange={onChange} />);
  act(() => press(tree));
  expect(onChange).toHaveBeenCalledWith(false);
});

test('disabled blocks changes', () => {
  const onChange = jest.fn();
  const tree = create(<Checkbox onChange={onChange} disabled />);
  act(() => press(tree));
  expect(onChange).not.toHaveBeenCalled();
  expect(box(tree).props.accessibilityState.disabled).toBe(true);
});
