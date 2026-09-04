import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import ScanCameraScreen from '../ScanCameraScreen';
import { createScan } from '../../../api/scans';
import { MOCK_SCAN } from '../../../api/__mocks__/scanFixtures';

const mockRequestPermission = jest.fn();
let mockPermissionState = { granted: true, canAskAgain: true };

let mockTakePicture;

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    __esModule: true,
    CameraView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: (...args) => mockTakePicture(...args),
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
jest.mock('../../../api/health', () => ({ warmUp: jest.fn(async () => true) }));
jest.mock('../../../lib/prepareImage', () => ({ prepareScanImage: jest.fn() }));

const { warmUp } = require('../../../api/health');
const { prepareScanImage } = require('../../../lib/prepareImage');

const PREPARED = {
  uri: 'file:///cache/out.jpg',
  mimeType: 'image/jpeg',
  fileName: 'scan.jpg',
};

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

beforeEach(() => {
  jest.clearAllMocks();
  mockTakePicture = jest.fn(async () => ({
    uri: 'file://captured.jpg',
    width: 4032,
    height: 3024,
  }));
  prepareScanImage.mockResolvedValue(PREPARED);
});

test('the ungranted state renders the "Camera Access" rationale', () => {
  mockPermissionState = { granted: false, canAskAgain: true };
  const tree = create(<ScanCameraScreen />);
  const t = texts(tree);
  expect(t).toContain('Camera Access');
  expect(t).toContain('To scan a plant, you need to allow camera access.');
  expect(t).toContain('Allow Camera Access');
  expect(t).toContain('Search by Name Instead');
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

  // The downscaled copy goes to the server; the original is what the user sees.
  expect(prepareScanImage).toHaveBeenCalledWith('file://captured.jpg', {
    width: 4032,
    height: 3024,
  });
  expect(createScan).toHaveBeenCalledWith(PREPARED);
  expect(api.route).toBe('scan-matches');
  expect(api.params.photoUri).toBe('file://captured.jpg');
  expect(api.params.scan).toBe(MOCK_SCAN);
});

test('uploads the original when preparation fails, rather than dropping the photo', async () => {
  mockPermissionState = { granted: true, canAskAgain: true };
  prepareScanImage.mockResolvedValueOnce(null);
  createScan.mockResolvedValueOnce(MOCK_SCAN);
  const tree = create(<ScanCameraScreen />);

  await press(tree, 'Shutter');

  expect(createScan).toHaveBeenCalledWith('file://captured.jpg');
  expect(api.route).toBe('scan-matches');
});

test('wakes the backend on mount, so a cold start is not billed to the scan', async () => {
  mockPermissionState = { granted: true, canAskAgain: true };
  create(<ScanCameraScreen />);
  expect(warmUp).toHaveBeenCalled();
});

test('does not ping the backend before camera access is granted', async () => {
  mockPermissionState = { granted: false, canAskAgain: true };
  create(<ScanCameraScreen />);
  expect(warmUp).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Error copy. Only a confirmed-dead connection may say "offline" — everything
// else names what actually happened, and carries the cause behind Details.
// ---------------------------------------------------------------------------
describe('failure copy', () => {
  const scanFailsWith = async (error) => {
    mockPermissionState = { granted: true, canAskAgain: true };
    createScan.mockRejectedValueOnce(error);
    const tree = create(<ScanCameraScreen />);
    await press(tree, 'Shutter');
    return tree;
  };

  test('says offline only when the failure was classified as offline', async () => {
    const tree = await scanFailsWith(
      Object.assign(new Error('Network request failed'), { code: 'offline' })
    );
    expect(texts(tree)).toContain('You’re offline.');
  });

  test('a failed upload on a live connection does not blame the connection', async () => {
    const tree = await scanFailsWith(
      Object.assign(new Error('The network connection was lost.'), { code: 'network' })
    );
    const t = texts(tree);
    expect(t).toContain('Couldn’t reach Cultum.');
    expect(t).not.toContain('You’re offline.');
  });

  test('names a slow server as a timeout', async () => {
    const tree = await scanFailsWith(Object.assign(new Error('too slow'), { code: 'timeout' }));
    expect(texts(tree)).toContain('That took too long.');
  });

  test('reveals the underlying cause behind Details', async () => {
    const tree = await scanFailsWith(
      Object.assign(new Error('boom'), { code: 'http', detail: 'Request failed with 502' })
    );
    expect(texts(tree).join(' ')).not.toContain('Request failed with 502');

    await press(tree, 'Error details');

    expect(texts(tree).join('')).toContain('http: Request failed with 502');
  });

  test('a camera failure is reported as a camera failure, not a server one', async () => {
    mockPermissionState = { granted: true, canAskAgain: true };
    mockTakePicture = jest.fn(async () => {
      throw new Error('capture session interrupted');
    });
    const tree = create(<ScanCameraScreen />);

    await press(tree, 'Shutter');

    expect(texts(tree)).toContain('Couldn’t take the photo.');
    expect(createScan).not.toHaveBeenCalled();
  });
});
