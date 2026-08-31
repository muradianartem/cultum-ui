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

// The Login screen (rendered when signed out) pulls in the SSO edges — stub them.
// It imports the Google *provider* entry point, so that is the path to mock;
// stubbing 'expo-auth-session' alone leaves the real provider running and it
// throws on the missing iosClientId under jest.
jest.mock('expo-auth-session/providers/google', () => ({
  __esModule: true,
  useIdTokenAuthRequest: () => [{}, null, jest.fn()],
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const RN = require('react-native');
  return { __esModule: true, LinearGradient: (props) => R.createElement(RN.View, props, props.children) };
});
jest.mock('../api/auth', () => ({
  authApi: { createNonce: jest.fn(async () => ({ nonce: 'srv', expires_in: 300 })) },
}));

// The AuthGate keys off persisted tokens — control the branch per test.
jest.mock('../lib/authStorage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
const { loadTokens } = require('../lib/authStorage');

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

async function renderApp() {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(<App />);
  });
  return tree;
}

afterEach(() => jest.clearAllMocks());

test('with no stored tokens, App shows the Login screen', async () => {
  loadTokens.mockResolvedValue(null);
  const tree = await renderApp();
  expect(texts(tree)).toContain('Continue with Google');
  expect(texts(tree)).not.toContain('Good afternoon, Allison');
});

test('with stored tokens, App boots to Today and wires the Scan/Add tab to the camera', async () => {
  loadTokens.mockResolvedValue({
    access_token: 'a',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 3600,
  });
  const tree = await renderApp();
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
