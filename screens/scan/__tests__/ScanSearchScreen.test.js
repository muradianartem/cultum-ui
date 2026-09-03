import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import ScanSearchScreen from '../ScanSearchScreen';
import { searchPlants } from '../../../api/plants';
import { MOCK_SEARCH } from '../../../api/__mocks__/scanFixtures';

jest.mock('../../../api/plants', () => ({
  searchPlants: jest.fn(),
  getSpecies: jest.fn(),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let api;
function Probe() {
  api = useRouter();
  return null;
}

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="scan-search">
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

const type = async (tree, value) => {
  const input = tree.root.findByType(TextInput);
  await act(async () => {
    input.props.onChangeText(value);
  });
  await act(async () => {
    jest.advanceTimersByTime(350); // past the debounce, then flush the fetch
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

test('typing two or more characters searches and renders result cards', async () => {
  searchPlants.mockResolvedValueOnce(MOCK_SEARCH);
  const tree = create(<ScanSearchScreen />);

  await type(tree, 'monstera');

  expect(searchPlants).toHaveBeenCalledWith('monstera');
  const t = texts(tree);
  expect(t).toContain('Monstera');
  expect(t).toContain('Swiss cheese vine');
});

test('a query with no results shows the "No results found" state', async () => {
  searchPlants.mockResolvedValueOnce([]);
  const tree = create(<ScanSearchScreen />);

  await type(tree, 'zzzzz');

  const t = texts(tree);
  expect(t).toContain('No results found');
  expect(t).toContain('Please try another name, or scan the plant instead.');
});

test('"Scan it instead" resets to the camera route', async () => {
  searchPlants.mockResolvedValueOnce([]);
  const tree = create(<ScanSearchScreen />);
  await type(tree, 'zzzzz');

  const btn = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === 'Scan it instead'
  );
  act(() => btn.props.onPress());

  expect(api.route).toBe('scan-camera');
  expect(api.canGoBack).toBe(false);
});
