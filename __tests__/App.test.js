import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';

// Native camera/library modules aren't available in jest — mock to plain stubs
// so App (which imports the scan screens) can mount.
jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    __esModule: true,
    CameraView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'x' }) }));
      return null;
    }),
    useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
  };
});
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

// App builds its own SafeAreaProvider with no metrics; the test renderer never
// measures a frame, so stub the provider to render children with fixed insets.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

test('App boots to the Today screen and wires the Scan/Add tab to the camera', () => {
  let tree;
  act(() => {
    tree = TestRenderer.create(<App />);
  });
  expect(texts(tree)).toContain('Good afternoon, Allison');

  const scanTab = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'tab' &&
      n.props.accessibilityLabel === 'Scan/Add'
  );
  act(() => scanTab.props.onPress());

  // The camera route's ungranted rationale renders.
  expect(texts(tree)).toContain('Identify by photo');
});
