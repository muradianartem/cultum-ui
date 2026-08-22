import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import Card from '../Card';
import { Card as BarrelCard } from '../index';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);

test('is exported from the components barrel', () => {
  expect(BarrelCard).toBe(Card);
});

test('renders title, subtitle and body', () => {
  const tree = create(<Card title="Monstera" subtitle="Needs water" body="Every 7 days." />);
  const t = texts(tree);
  expect(t).toContain('Monstera');
  expect(t).toContain('Needs water');
  expect(t).toContain('Every 7 days.');
});

test('renders the icon inside a badge', () => {
  const tree = create(<Card title="x" icon={<View testID="ic" />} />);
  expect(
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'ic')
  ).toHaveLength(1);
});

test('omitted subtitle/body/actions do not render', () => {
  const tree = create(<Card title="Only" />);
  expect(texts(tree)).toEqual(['Only']);
});

test('renders 1 or 2 actions and fires them', () => {
  const onPrimary = jest.fn();
  const tree = create(
    <Card
      title="x"
      primaryAction={{ label: 'Water', onPress: onPrimary }}
      secondaryAction={{ label: 'Snooze', onPress: () => {} }}
    />
  );
  const t = texts(tree);
  expect(t).toContain('Water');
  expect(t).toContain('Snooze');
});
