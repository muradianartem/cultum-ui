import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import ScanMatchesScreen from '../ScanMatchesScreen';
import { getSpecies } from '../../../api/plants';
import { confirmScan } from '../../../api/scans';
import { MOCK_SCAN, MOCK_DETAIL } from '../../../api/__mocks__/scanFixtures';

jest.mock('../../../api/plants', () => ({ getSpecies: jest.fn() }));
jest.mock('../../../api/scans', () => ({ confirmScan: jest.fn() }));

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
        <Router initial="scan-matches">
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

const press = async (tree, label) => {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label
  );
  await act(async () => {
    await node.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  confirmScan.mockResolvedValue({});
});

test('renders the design caption and one card per candidate with its confidence', () => {
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={MOCK_SCAN} />);
  const t = texts(tree);
  expect(t).toContain(
    '52% is a guess, not an answer. Retake it closer, or search by name.'
  );
  expect(t).toContain('Swiss cheese plant');
  expect(t).toContain('Golden pothos');
  expect(t).toContain('52%');
  expect(t).toContain('23%');
  expect(t).toContain('None of these?');
});

test('tapping a card confirms that candidate and opens the product page', async () => {
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={MOCK_SCAN} />);

  await press(tree, 'Swiss cheese plant');

  expect(confirmScan).toHaveBeenCalledWith(MOCK_SCAN.id, MOCK_SCAN.candidates[0].id);
  expect(api.route).toBe('product');
  expect(api.params.plant.commonName).toBe('Monstera');
});

test('the top match renders from the inline care payload without a detail fetch', async () => {
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={MOCK_SCAN} />);

  await press(tree, 'Swiss cheese plant');

  expect(getSpecies).not.toHaveBeenCalled();
  expect(api.params.plant.careFacts.find((f) => f.label === 'Sun').value).toBe(
    'Bright, indirect'
  );
});

test('a lower-ranked candidate fetches its own detail by species key', async () => {
  getSpecies.mockResolvedValueOnce(MOCK_DETAIL);
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={MOCK_SCAN} />);

  await press(tree, 'Golden pothos');

  expect(confirmScan).toHaveBeenCalledWith(MOCK_SCAN.id, MOCK_SCAN.candidates[2].id);
  expect(getSpecies).toHaveBeenCalledWith('epipremnum-aureum');
});

test('"Search manually" records a none-of-these label and routes to search', async () => {
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={MOCK_SCAN} />);

  await press(tree, 'Search manually');

  expect(confirmScan).toHaveBeenCalledWith(MOCK_SCAN.id, null);
  expect(api.route).toBe('scan-search');
});

test('a failed confirm never blocks navigation', async () => {
  confirmScan.mockRejectedValue(new Error('offline'));
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={MOCK_SCAN} />);

  await press(tree, 'Search manually');

  expect(api.route).toBe('scan-search');
});

test('an empty candidate list shows the no-match state instead of the list', () => {
  const tree = create(
    <ScanMatchesScreen photoUri="file://photo.jpg" scan={{ ...MOCK_SCAN, candidates: [] }} />
  );
  const t = texts(tree);
  expect(t).toContain('No plant found');
  expect(t).not.toContain('Swiss cheese plant');
});
