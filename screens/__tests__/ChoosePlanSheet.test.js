import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import ChoosePlanSheet from '../ChoosePlanSheet';

const PRODUCTS = [
  { key: 'yearly', label: 'Yearly', badge: 'Best value', period: 'year', fallbackPrice: '$39.99', appleProductId: 'y' },
  { key: 'monthly', label: 'Monthly', badge: null, period: 'month', fallbackPrice: '$5.99', appleProductId: 'm' },
];

const texts = (tree) => tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));
const row = (tree, key) =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.testID === `plan-${key}`);

const mounted = [];
const render = (props) => {
  let tree;
  act(() => {
    tree = TestRenderer.create(<ChoosePlanSheet visible products={PRODUCTS} initialPlan="yearly" {...props} />);
  });
  mounted.push(tree);
  return tree;
};
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
});

test('without StoreKit terms it shows the fallback prices', () => {
  const tree = render();
  expect(texts(tree)).toEqual(expect.arrayContaining(['$39.99', '$5.99']));
  expect(row(tree, 'yearly').props.accessibilityLabel).toBe('Yearly, $39.99 per year');
});

test('StoreKit’s localized price replaces the fallback, per resolved SKU', () => {
  const termsFor = (p) => (p.key === 'yearly' ? { displayPrice: '54,99 €', periodLabel: 'year', trial: null } : null);
  const tree = render({ termsFor });
  expect(texts(tree)).toContain('54,99 €');
  expect(texts(tree)).not.toContain('$39.99');
  expect(row(tree, 'yearly').props.accessibilityLabel).toBe('Yearly, 54,99 € per year');
  // Monthly has not resolved, so it still has only the backend's copy.
  expect(texts(tree)).toContain('$5.99');
});
