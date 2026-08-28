import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router } from '../../../routing';
import { useRouter } from '../../../routing';
import ScanMatchesScreen from '../ScanMatchesScreen';
import { getPlantDetail } from '../../../api/plants';
import { MOCK_DETAIL } from '../../../api/__mocks__/scanFixtures';

jest.mock('../../../api/plants', () => ({ getPlantDetail: jest.fn() }));

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

const SCAN = {
  candidates: [
    {
      rank: 1,
      scientific_name: 'Monstera deliciosa',
      common_name: 'Swiss cheese plant',
      probability: 0.52,
      provider_ref: '2868',
      reference_image_url: 'https://img/monstera.jpg',
    },
    {
      rank: 2,
      scientific_name: 'Epipremnum aureum',
      common_name: 'Golden pothos',
      probability: 0.23,
      provider_ref: '3126',
      reference_image_url: null,
    },
  ],
};

test('renders the design caption and one card per candidate with its confidence', () => {
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={SCAN} />);
  const t = texts(tree);
  expect(t).toContain(
    '52% is a guess, not an answer. Retake it closer, or search by name.'
  );
  expect(t).toContain('Swiss cheese plant');
  expect(t).toContain('Golden pothos');
  expect(t).toContain('52%');
  expect(t).toContain('23%');
});

const pressRow = async (tree, label) => {
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

test('tapping a card fetches detail and navigates to the product page', async () => {
  getPlantDetail.mockResolvedValueOnce(MOCK_DETAIL);
  const tree = create(<ScanMatchesScreen photoUri="file://photo.jpg" scan={SCAN} />);

  await pressRow(tree, 'Swiss cheese plant');

  expect(getPlantDetail).toHaveBeenCalledWith('2868', 'perenual');
  expect(api.route).toBe('product');
  expect(api.params.plant.commonName).toBe('Monstera');
});
