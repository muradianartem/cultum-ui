import TestRenderer, { act } from 'react-test-renderer';
import { ImageBackground, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router } from '../../routing';
import ProductPage from '../ProductPage';
import { CARE_FACTS, CHIPS, FAQ, PLANT } from '../plantData';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="product">{el}</Router>
      </SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));
const hero = (tree) => tree.root.findAllByType(ImageBackground)[0];

const VM = {
  commonName: 'Snake plant',
  latinName: 'Dracaena trifasciata',
  about: 'A hardy succulent that tolerates neglect.',
  heroUri: 'https://img/snake.jpg',
  careFacts: CARE_FACTS,
  chips: CHIPS,
  faq: FAQ,
};

test('renders the passed plant view-model name and a remote hero', () => {
  const tree = create(<ProductPage plant={VM} />);
  const t = texts(tree);
  expect(t).toContain('Snake plant');
  expect(t).toContain('Dracaena trifasciata');
  expect(hero(tree).props.source).toEqual({ uri: 'https://img/snake.jpg' });
});

test('with no plant prop renders the static default and the bundled hero asset', () => {
  const tree = create(<ProductPage />);
  expect(texts(tree)).toContain(PLANT.commonName);
  // Bundled asset resolves to a number (require id), never a { uri } object.
  expect(hero(tree).props.source).not.toHaveProperty('uri');
});
