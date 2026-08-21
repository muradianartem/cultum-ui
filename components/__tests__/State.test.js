import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import State from '../State';
import { State as BarrelState } from '../index';
import { emptyState } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
const root = (tree) =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'summary');
const rootStyle = (tree) =>
  Object.assign({}, ...[].concat(root(tree).props.style).filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelState).toBe(State);
});

test('renders title and subtitle', () => {
  const tree = create(<State title="No plants yet" subtitle="Add your first one" />);
  expect(texts(tree)).toContain('No plants yet');
  expect(texts(tree)).toContain('Add your first one');
});

test('card variant applies the grey panel', () => {
  expect(rootStyle(create(<State variant="card" title="x" />)).backgroundColor).toBe(
    emptyState.cardBg
  );
  expect(rootStyle(create(<State title="x" />)).backgroundColor).toBeUndefined();
});

test('renders the icon inside a badge', () => {
  const tree = create(<State title="x" icon={<View testID="ic" />} />);
  expect(
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'ic')
  ).toHaveLength(1);
});

test('actions render and fire', () => {
  const onPrimary = jest.fn();
  const tree = create(
    <State
      title="x"
      primaryAction={{ label: 'Add plant', onPress: onPrimary }}
      secondaryAction={{ label: 'Learn more', onPress: () => {} }}
    />
  );
  expect(texts(tree)).toContain('Add plant');
  expect(texts(tree)).toContain('Learn more');
});
