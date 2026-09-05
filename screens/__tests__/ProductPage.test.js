import TestRenderer, { act } from 'react-test-renderer';
import { ImageBackground, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../routing';
import ProductPage from '../ProductPage';
import { CARE_FACTS, CHIPS, FAQ, PLANT } from '../plantData';

let api;
function Probe() {
  api = useRouter();
  return null;
}

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="product">
          <Probe />
          {el}
        </Router>
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

// Fire the deepest onPress for the button whose accessible label matches.
const pressButton = (tree, label) => {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label
  );
  act(() => node.props.onPress());
};

test('Add to my plants opens the add-a-plant flow with the view-model', () => {
  const tree = create(<ProductPage plant={VM} />);
  pressButton(tree, 'Add to my plants');

  expect(api.route).toBe('add-plant');
  expect(api.params).toEqual({ plant: VM });
});

test('an owned plant renders the added layout under the name it was given', () => {
  const tree = create(<ProductPage plant={VM} owned nickname="Mo" room="Kitchen" />);
  const t = texts(tree);
  // The CTA is gone, and the hero goes by the nickname over species · room.
  expect(t).not.toContain('Add to my plants');
  expect(t).toContain('Mo');
  expect(t).toContain('Snake plant · Kitchen');
});

test('an owned plant with no nickname keeps the species name in the hero', () => {
  const tree = create(<ProductPage plant={VM} owned />);
  const t = texts(tree);
  expect(t).toContain('Snake plant');
  expect(t).toContain('Dracaena trifasciata');
});

test('Settings on an owned plant navigates to the reminders route with the plant name', () => {
  const tree = create(<ProductPage plant={VM} owned />);
  // Settings only appears once the plant is added.
  pressButton(tree, 'Settings');

  expect(api.route).toBe('reminders');
  expect(api.params).toEqual({ plantName: 'Snake plant' });
});
