import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import ScanCameraScreen from '../ScanCameraScreen';
import { createScan } from '../../../api/scans';
import { MOCK_SCAN } from '../../../api/__mocks__/scanFixtures';

const mockRequestPermission = jest.fn();
let mockPermissionState = { granted: true, canAskAgain: true };

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    __esModule: true,
    CameraView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: async () => ({ uri: 'file://captured.jpg' }),
      }));
      return null;
    }),
    useCameraPermissions: () => [mockPermissionState, mockRequestPermission],
  };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock('../../../api/scans', () => ({ createScan: jest.fn() }));

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
        <Router initial="scan-camera">
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

beforeEach(() => jest.clearAllMocks());

test('the ungranted state renders the "Identify by photo" rationale', () => {
  mockPermissionState = { granted: false, canAskAgain: true };
  const tree = create(<ScanCameraScreen />);
  const t = texts(tree);
  expect(t).toContain('Identify by photo');
  expect(t).toContain('Allow camera access');
});

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

test('with permission granted, firing the shutter scans and opens Matches', async () => {
  mockPermissionState = { granted: true, canAskAgain: true };
  createScan.mockResolvedValueOnce(MOCK_SCAN);
  const tree = create(<ScanCameraScreen />);

  await press(tree, 'Shutter');

  expect(createScan).toHaveBeenCalledWith('file://captured.jpg');
  expect(api.route).toBe('scan-matches');
  expect(api.params.photoUri).toBe('file://captured.jpg');
  expect(api.params.scan).toBe(MOCK_SCAN);
});
