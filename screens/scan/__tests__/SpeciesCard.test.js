import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import SpeciesCard from '../SpeciesCard';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

const CARD = {
  title: 'Swiss cheese plant',
  subtitle: 'Monstera deliciosa',
  thumbUri: 'https://img/monstera.jpg',
  percent: 52,
  sourceId: '2868',
  source: 'perenual',
};

test('renders the title, subtitle and confidence percent when showConfidence', () => {
  const tree = create(<SpeciesCard card={CARD} showConfidence onPress={() => {}} />);
  const t = texts(tree);
  expect(t).toContain('Swiss cheese plant');
  expect(t).toContain('Monstera deliciosa');
  expect(t).toContain('52%');
});

test('hides the confidence percent when showConfidence is false', () => {
  const tree = create(<SpeciesCard card={CARD} showConfidence={false} onPress={() => {}} />);
  expect(texts(tree)).not.toContain('52%');
});

test('fires onPress when the row is pressed', () => {
  const onPress = jest.fn();
  const tree = create(<SpeciesCard card={CARD} showConfidence onPress={onPress} />);
  const row = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === 'Swiss cheese plant'
  );
  act(() => row.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});
