import TestRenderer, { act } from 'react-test-renderer';
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
// The glyph is Figma's vector, tagged by which one it is.
const glyph = (tree) => {
  const found = tree.root.findAll(
    (n) => n.props.testID === 'checkbox-tick' || n.props.testID === 'checkbox-dash'
  );
  return found.length ? found[0].props.testID : null;
};

test('is exported from the components barrel', () => {
  expect(BarrelCheckbox).toBe(Checkbox);
});

test('unchecked shows no glyph', () => {
  expect(glyph(create(<Checkbox />))).toBeNull();
});

test('checked shows a check and reports checked to a11y', () => {
  const tree = create(<Checkbox checked />);
  expect(glyph(tree)).toBe('checkbox-tick');
  expect(box(tree).props.accessibilityState.checked).toBe(true);
});

test('indeterminate shows a dash and reports mixed', () => {
  const tree = create(<Checkbox indeterminate />);
  expect(glyph(tree)).toBe('checkbox-dash');
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

test('disabled follows Figma: a faded empty box, an unfaded filled one', () => {
  const flat = (tree) =>
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.style).map((n) =>
      Object.assign({}, ...[].concat(n.props.style).flat(Infinity).filter(Boolean))
    );
  expect(flat(create(<Checkbox disabled />)).some((s) => s.opacity === 0.5)).toBe(true);
  expect(flat(create(<Checkbox checked disabled />)).some((s) => s.opacity < 1)).toBe(false);
});
