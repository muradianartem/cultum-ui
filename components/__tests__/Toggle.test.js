import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Toggle from '../Toggle';
import { Toggle as BarrelToggle } from '../index';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { colorTokens } from '../../theme/colorTokens';

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

// Colour assertions render inside a ThemeProvider pinned to a mode so they are
// deterministic; useTheme() otherwise falls back to the light theme.
function createThemed(el, mode = 'light') {
  let tree;
  act(() => {
    tree = TestRenderer.create(<ThemeProvider initialMode={mode}>{el}</ThemeProvider>);
  });
  return tree;
}

const flat = (node) => Object.assign({}, ...[].concat(node.props.style).filter(Boolean));

// The thumb is the only Animated.View child carrying a transform.
const thumbStyle = (tree) =>
  flat(
    tree.root.find(
      (n) =>
        typeof n.type === 'string' &&
        flat(n).transform !== undefined &&
        n.props.accessibilityRole !== 'switch'
    )
  );

test('on/off map to the brand + neutral semantic tokens (Figma 27383:1945)', () => {
  const on = createThemed(<Toggle value />);
  expect(flat(sw(on)).backgroundColor).toBe(colorTokens.brand.primary.light);
  expect(thumbStyle(on).backgroundColor).toBe(colorTokens.background.primary.light);

  const off = createThemed(<Toggle value={false} />);
  expect(flat(sw(off)).backgroundColor).toBe(colorTokens.surface.secondary.light);
  expect(thumbStyle(off).backgroundColor).toBe(colorTokens.border.primary.light);
});
