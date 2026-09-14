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

// The paywall's copy is fetched, never bundled, and jest-expo has no fetch.
// Unanswered by default: the launcher then has nothing to open, which is what
// every test below except the last one wants.
jest.mock('../api/billing', () => ({
  ...jest.requireActual('../api/billing'),
  getPaywall: jest.fn(() => new Promise(() => {})),
}));
const { getPaywall } = require('../api/billing');
const { __resetPaywallCache } = require('../billing/paywallContent');

const PAYWALL_RESPONSE = {
  title: 'Cultum Plus, free for 7 days',
  trial_days: 7,
  timeline: [{ day: 0, label: 'Today', title: 'Full access', body: 'Everything on.' }],
  features: [{ key: 'plants', label: 'Unlimited plants', free: '5 plants', plus: null }],
  products: [
    {
      key: 'yearly',
      label: 'Yearly',
      period: 'year',
      fallback_price: '$39.99',
      trial_days: 7,
      default: true,
    },
  ],
  footnote: 'Cancel any time.',
};

// Whether the paywall opens at all is its own decision (billing/entry.js has
// the truth table); here it is a dial, so each test can state which app it is
// booting.
jest.mock('../billing/entry', () => ({ paywallEntryRoute: jest.fn(() => null) }));
const { paywallEntryRoute } = require('../billing/entry');

// The AuthGate keys off persisted tokens — control the branch per test.
jest.mock('../lib/authStorage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
const { loadTokens } = require('../lib/authStorage');

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// The garden provider holds a clock interval and an AppState subscription that
// are only released on unmount — leave a tree mounted and the worker hangs.
const mounted = [];

async function renderApp() {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(<App />);
  });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop().unmount();
  });
  jest.clearAllMocks();
  __resetPaywallCache();
});

test('with no stored tokens, App shows the Login screen', async () => {
  loadTokens.mockResolvedValue(null);
  const tree = await renderApp();
  expect(texts(tree)).toContain('Continue with Google');
  expect(texts(tree)).not.toContain('Today’s tasks');
});

const STORED_TOKENS = {
  access_token: 'a',
  refresh_token: 'r',
  token_type: 'bearer',
  expires_in: 3600,
};

test('with stored tokens, App boots to Today and wires the Scan/Add tab to the camera', async () => {
  loadTokens.mockResolvedValue({
    access_token: 'a',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 3600,
  });
  const tree = await renderApp();
  // A fresh install has no plants, so Today opens on its empty state — what
  // matters here is that the router mounted at all.
  expect(texts(tree)).toContain('Today’s tasks');
  expect(texts(tree)).toContain('No plants yet');

  const scanTab = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'tab' &&
      n.props.accessibilityLabel === 'Scan/Add'
  );
  act(() => scanTab.props.onPress());

  // The camera route's ungranted rationale renders.
  expect(texts(tree)).toContain('Camera Access');
});

test('the paywall opens over Today once the backend has priced it', async () => {
  loadTokens.mockResolvedValue(STORED_TOKENS);
  paywallEntryRoute.mockReturnValue('paywall');
  getPaywall.mockResolvedValue(PAYWALL_RESPONSE);
  const tree = await renderApp();

  expect(texts(tree)).toContain('Cultum Plus,\nfree for 7 days');
  expect(texts(tree)).not.toContain('Today\u2019s tasks');
  // It was asked about the session it actually got, not about nothing.
  expect(paywallEntryRoute).toHaveBeenCalledWith({ signedInVia: 'restore' });
});

// The whole reason the launcher waits instead of <Router initial>: with nothing
// bundled, a paywall that cannot be priced has nothing to say, and blocking the
// app behind a failed request would be worse than not selling.
test('a paywall that cannot be priced never opens, and Today is not blocked', async () => {
  loadTokens.mockResolvedValue(STORED_TOKENS);
  paywallEntryRoute.mockReturnValue('paywall');
  getPaywall.mockRejectedValue(Object.assign(new Error('offline'), { code: 'offline' }));
  const tree = await renderApp();

  expect(texts(tree)).toContain('Today\u2019s tasks');
  expect(texts(tree)).not.toContain('Cultum Plus,\nfree for 7 days');
});
