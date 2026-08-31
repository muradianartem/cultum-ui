import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, ActivityIndicator } from 'react-native';
import Button from '../Button';
import { Button as BarrelButton } from '../index';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { colorTokens } from '../../theme/colorTokens';

// Render inside a ThemeProvider pinned to a mode so colour assertions are
// deterministic (default 'light'); pass mode="dark" to check the dark theme.
function create(el, mode = 'light') {
  let tree;
  act(() => {
    tree = TestRenderer.create(<ThemeProvider initialMode={mode}>{el}</ThemeProvider>);
  });
  return tree;
}

// The host node the press handler + a11y live on.
function btn(tree) {
  return tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button'
  );
}

// Its resolved style, flattened to one object.
function btnStyle(tree) {
  return Object.assign({}, ...[].concat(btn(tree).props.style).filter(Boolean));
}

test('is exported from the components barrel', () => {
  expect(BarrelButton).toBe(Button);
});

test('primary is the brand-green CTA (brand-primary = primary-500) with dark ink', () => {
  const tree = create(<Button label="Go" />);
  expect(btnStyle(tree).backgroundColor).toBe(colorTokens.brand.primary.light);
  expect(btnStyle(tree).backgroundColor).toBe('#93EC7C'); // the brand green
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: colorTokens.brand.onPrimary.light })])
  );
});

test('secondary uses the brand-secondary token', () => {
  const tree = create(<Button label="More" variant="secondary" />);
  expect(btnStyle(tree).backgroundColor).toBe(colorTokens.brand.secondary.light);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: colorTokens.brand.onSecondary.light })])
  );
});

test('primary follows the theme: dark mode resolves brand-primary.dark', () => {
  const tree = create(<Button label="Go" />, 'dark');
  expect(btnStyle(tree).backgroundColor).toBe(colorTokens.brand.primary.dark);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: colorTokens.brand.onPrimary.dark })])
  );
});

test('destructive primary uses the error-primary token', () => {
  const tree = create(<Button label="Delete" destructive />);
  expect(btnStyle(tree).backgroundColor).toBe(colorTokens.error.primary.light);
});

test('outline draws a 1px border in the border-primary token colour', () => {
  const tree = create(<Button label="More" variant="outline" />);
  const s = btnStyle(tree);
  expect(s.borderWidth).toBe(1);
  expect(s.borderColor).toBe(colorTokens.border.primary.light);
});

// Figma's Type=Outlined is an opaque pill (tokens.js button.outline.bg), not a
// see-through one — it has to cover photography on the auth Welcome screen.
test('outline fills with background-primary rather than staying transparent', () => {
  const tree = create(<Button label="More" variant="outline" />);
  expect(btnStyle(tree).backgroundColor).toBe(colorTokens.background.primary.light);
});

test('size maps to Figma pill height (lg 56 / md 48 / sm 40)', () => {
  expect(btnStyle(create(<Button label="a" size="lg" />)).height).toBe(56);
  expect(btnStyle(create(<Button label="a" size="md" />)).height).toBe(48);
  expect(btnStyle(create(<Button label="a" size="sm" />)).height).toBe(40);
});

test('disabled uses the disabled surface + ink tokens and blocks interaction', () => {
  const tree = create(<Button label="x" disabled />);
  expect(btnStyle(tree).backgroundColor).toBe(colorTokens.disabled.surface.light);
  expect(btn(tree).props.accessibilityState.disabled).toBe(true);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: colorTokens.disabled.on.light })])
  );
});

test('loading shows a spinner instead of the label and marks busy', () => {
  const tree = create(<Button label="Saving" loading />);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  expect(btn(tree).props.accessibilityState.busy).toBe(true);
});
