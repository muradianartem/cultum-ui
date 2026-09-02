import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockBack = jest.fn();
const mockReset = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const RN = require('react-native');
  return { __esModule: true, LinearGradient: (props) => R.createElement(RN.View, props, props.children) };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../routing', () => ({
  useRouter: () => ({ back: mockBack, reset: mockReset, canGoBack: mockCanGoBack }),
}));

import PaywallScreen from '../PaywallScreen';
import { colorTokens } from '../../theme/colorTokens';

const texts = (tree) => tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// BottomSheet kicks off an Animated.timing on mount, so creation has to be
// wrapped in act() or the renderer tears down mid-update.
const render = () => {
  let tree;
  act(() => {
    tree = TestRenderer.create(<PaywallScreen />);
  });
  return tree;
};

// The host node carries the resolved style; the composite above it still holds
// a style function (see docs/figma-import.md's jest-expo notes).
const hostButton = (tree, label) =>
  tree.root.find(
    (n) =>
      typeof n.type === 'string' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label
  );

const press = (tree, label) =>
  tree.root
    .find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label
    )
    .props.onPress();

afterEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});

test('renders the headline, price line and both CTAs', () => {
  const tree = render();
  expect(texts(tree)).toContain('Cultum Plus,\nfree for 7 days');
  expect(texts(tree)).toContain('7 days free, then $39.99 a year');
  expect(texts(tree)).toContain('Start free trial');
  expect(texts(tree)).toContain('See all plans');
});

test('renders the three trial steps', () => {
  const tree = render();
  for (const day of ['Today', 'Day 5', 'Day 7']) expect(texts(tree)).toContain(day);
  expect(texts(tree)).toContain('Full access');
  expect(texts(tree)).toContain('Trial ends');
});

test('the comparison table has 9 feature rows, 5 of them Limited on the free tier', () => {
  const tree = render();
  // findAllByProps matches the composite *and* its host node — keep the hosts.
  const rows = tree.root.findAll(
    (n) => typeof n.type === 'string' && n.props.testID === 'paywall-feature-row'
  );
  expect(rows).toHaveLength(9);
  expect(texts(tree).filter((c) => c === 'Limited')).toHaveLength(5);
  expect(texts(tree)).toContain('Shared household');
});

test('renders the rating and both reviews', () => {
  const tree = render();
  expect(texts(tree)).toContain('4.8');
  expect(texts(tree)).toContain('6.2K ratings');
  expect(texts(tree)).toContain('Rina');
  expect(texts(tree)).toContain('Tomas');
});

test('the close button pops the router, or goes home with no history', () => {
  const tree = render();
  act(() => press(tree, 'Close'));
  expect(mockBack).toHaveBeenCalled();
  expect(mockReset).not.toHaveBeenCalled();

  mockCanGoBack = false;
  const fresh = render();
  act(() => press(fresh, 'Close'));
  expect(mockReset).toHaveBeenCalledWith('today');
});

describe('the Choose a plan sheet', () => {
  test('is closed until "See all plans" is pressed', () => {
    const tree = render();
    expect(texts(tree)).not.toContain('Choose a plan');

    act(() => press(tree, 'See all plans'));
    expect(texts(tree)).toContain('Choose a plan');
    expect(texts(tree)).toContain('Yearly');
    expect(texts(tree)).toContain('Monthly');
    expect(texts(tree)).toContain('Best value');
  });

  test('preselects the yearly plan and moves the ring on selection', () => {
    const tree = render();
    act(() => press(tree, 'See all plans'));

    // Style lands on the host node; onPress stays on the composite above it.
    const row = (id) =>
      tree.root.find((n) => typeof n.type === 'string' && n.props.testID === `plan-${id}`);
    const pressRow = (id) =>
      tree.root
        .find((n) => typeof n.type !== 'string' && n.props.testID === `plan-${id}`)
        .props.onPress();
    const ringOf = (id) =>
      Object.assign({}, ...[].concat(row(id).props.style).filter(Boolean)).borderColor;

    expect(row('yearly').props.accessibilityState.checked).toBe(true);
    expect(ringOf('yearly')).toBe(colorTokens.text.primary.light);
    expect(ringOf('monthly')).toBe('transparent');

    act(() => pressRow('monthly'));
    expect(ringOf('monthly')).toBe(colorTokens.text.primary.light);
    expect(ringOf('yearly')).toBe('transparent');
  });

  test('"Done" closes the sheet', () => {
    const tree = render();
    act(() => press(tree, 'See all plans'));
    expect(texts(tree)).toContain('Choose a plan');

    act(() => press(tree, 'Done'));
    expect(texts(tree)).not.toContain('Choose a plan');
  });
});
