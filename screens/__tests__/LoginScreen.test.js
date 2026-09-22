import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform, Text } from 'react-native';

// --- Mock the native / async edges the Login screen depends on ---
const mockPromptAsync = jest.fn(async () => ({ type: 'dismiss' }));
let mockResponse = null; // per-test override of the auth-request response
// The screen imports the Google *provider* entry point, not the base module —
// mocking 'expo-auth-session' alone leaves the real provider running (and it
// throws on a missing iosClientId under jest).
const mockUseIdTokenAuthRequest = jest.fn(() => [{ /* request */ }, mockResponse, mockPromptAsync]);
jest.mock('expo-auth-session/providers/google', () => ({
  __esModule: true,
  useIdTokenAuthRequest: (...args) => mockUseIdTokenAuthRequest(...args),
}));
// Which platforms this build has a real Google client id for. Parsing the
// app.json placeholders is lib/config's job (and its tests'); here an id is
// either configured or it isn't.
const CONFIGURED_GOOGLE_IDS = { web: 'web-id', ios: 'ios-id', android: 'android-id' };
let mockGoogleIds = { ...CONFIGURED_GOOGLE_IDS };
jest.mock('../../lib/config', () => ({
  get GOOGLE_CLIENT_IDS() {
    return mockGoogleIds;
  },
  googleClientIdFor: (platform = require('react-native').Platform.OS) => mockGoogleIds[platform] ?? null,
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
// Sign in with Apple: available by default (the screen hides the button when
// it isn't), with each test free to override the two calls it makes.
let mockAppleAvailable = true;
const mockAppleSignIn = jest.fn(async () => ({
  identityToken: 'apple-id-token',
  authorizationCode: 'code',
  user: 'apple-user',
  fullName: { givenName: 'Ada', familyName: 'Lovelace' },
  email: 'ada@example.com',
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => mockAppleAvailable),
  signInAsync: (...args) => mockAppleSignIn(...args),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const RN = require('react-native');
  return { __esModule: true, LinearGradient: (props) => R.createElement(RN.View, props, props.children) };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../api/auth', () => ({
  authApi: { createNonce: jest.fn(async () => ({ nonce: 'srv', expires_in: 300 })) },
}));
jest.mock('../../billing/paywallContent', () => ({ prefetchPaywall: jest.fn() }));
const { prefetchPaywall } = require('../../billing/paywallContent');
const mockCompleteGoogleLogin = jest.fn(async () => {});
const mockCompleteAppleLogin = jest.fn(async () => {});
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    completeGoogleLogin: mockCompleteGoogleLogin,
    completeAppleLogin: mockCompleteAppleLogin,
    status: 'signedOut',
  }),
}));

import LoginScreen from '../LoginScreen';

const IOS = Platform.OS;

const texts = (tree) => tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

async function render() {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(<LoginScreen />);
  });
  return tree;
}

afterEach(() => {
  jest.clearAllMocks();
  mockResponse = null;
  mockAppleAvailable = true;
  mockGoogleIds = { ...CONFIGURED_GOOGLE_IDS };
  Platform.OS = IOS;
});

// The *host* node carries the resolved style; the composite Pressable above it
// still holds a style function (see docs/figma-import.md's jest-expo notes).
const findButton = (tree, label) =>
  tree.root.find(
    (n) =>
      typeof n.type === 'string' &&
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label
  );

// The press handler lives on the composite wrapper, not the host node.
const pressableFor = (tree, label) =>
  tree.root.find(
    (n) =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label
  );

const pressButton = (tree, label) => pressableFor(tree, label).props.onPress();

test('renders the Google and Apple continue buttons', async () => {
  const tree = await render();
  expect(texts(tree)).toContain('Continue with Google');
  expect(texts(tree)).toContain('Continue with Apple');
});

// Figma "Auth / Welcome" drops the email provider: the backend has no
// email/OTP endpoint, so neither the button nor its "Or" divider ship.
test('does not offer the email provider', async () => {
  const tree = await render();
  expect(texts(tree)).not.toContain('Continue with email');
  expect(texts(tree)).not.toContain('Or');
});

test('renders the full 12-photo mosaic behind the content', async () => {
  const tree = await render();
  expect(tree.root.findAllByProps({ testID: 'welcome-mosaic-photo' }).length).toBeGreaterThanOrEqual(12);
});

test('renders the wordmark, tagline and legal line', async () => {
  const tree = await render();
  expect(texts(tree)).toContain('Cultum.app');
  expect(texts(tree)).toContain(
    'Better plant-care reminders, so you never forget your plants again.'
  );
  // The legal line is one <Text> whose children JSX splits across string
  // fragments and two nested underlined spans — compare the concatenation.
  const allText = texts(tree)
    .filter((c) => typeof c === 'string')
    .join('')
    .replace(/\s+/g, ' ');
  expect(allText).toContain('By continuing you agree to the');
  expect(allText).toContain('Terms of Use');
  expect(allText).toContain('Privacy Policy');
});

// Both providers are Figma's "Type=Outlined" pill; outline resolves to an
// opaque background.primary fill so they read as solid over the photos.
test('both provider buttons are opaque outlined pills', async () => {
  const tree = await render();
  for (const label of ['Continue with Google', 'Continue with Apple']) {
    const style = Object.assign({}, ...[].concat(findButton(tree, label).props.style).filter(Boolean));
    expect(style.borderWidth).toBe(1);
    expect(style.backgroundColor).toBe('#151515'); // background.primary (dark)
    expect(style.height).toBe(56); // Size=Large
  }
});

// The nonce is the whole replay defense: Apple echoes it into the identity
// token's `nonce` claim, and the backend burns it. Sending our own — or none —
// would hand the backend a token it cannot bind to this attempt.
test('pressing Apple signs in with the server nonce and exchanges the identity token', async () => {
  const tree = await render();

  await act(async () => {
    await pressButton(tree, 'Continue with Apple');
  });

  expect(mockAppleSignIn).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'srv' }));
  expect(mockCompleteAppleLogin).toHaveBeenCalledWith('apple-id-token', 'Ada');
  expect(mockPromptAsync).not.toHaveBeenCalled();
});

// Apple only discloses the name on the first-ever authorization; every later
// sign-in has fullName: null and still has to go through.
test('a returning Apple user with no name still exchanges the identity token', async () => {
  mockAppleSignIn.mockResolvedValueOnce({
    identityToken: 'apple-id-token',
    authorizationCode: 'code',
    user: 'apple-user',
    fullName: null,
    email: null,
  });
  const tree = await render();

  await act(async () => {
    await pressButton(tree, 'Continue with Apple');
  });

  expect(mockCompleteAppleLogin).toHaveBeenCalledWith('apple-id-token', null);
});

test('backing out of the Apple sheet is silent — no error snackbar', async () => {
  const canceled = Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' });
  mockAppleSignIn.mockRejectedValueOnce(canceled);
  const tree = await render();

  await act(async () => {
    await pressButton(tree, 'Continue with Apple');
  });

  expect(mockCompleteAppleLogin).not.toHaveBeenCalled();
  expect(texts(tree)).not.toContain("Couldn't sign in. Try again.");
});

test('a failed Apple sign-in surfaces the error snackbar', async () => {
  mockAppleSignIn.mockRejectedValueOnce(new Error('boom'));
  const tree = await render();

  await act(async () => {
    await pressButton(tree, 'Continue with Apple');
  });

  expect(texts(tree)).toContain("Couldn't sign in. Try again.");
});

// Android and web have no implementation — offering the button there would
// only produce an UnavailabilityError.
test('hides the Apple button where Sign in with Apple is unavailable', async () => {
  mockAppleAvailable = false;
  const tree = await render();

  expect(texts(tree)).not.toContain('Continue with Apple');
  expect(texts(tree)).toContain('Continue with Google');
});

test('a successful Google response exchanges the id_token via completeGoogleLogin', async () => {
  mockResponse = { type: 'success', params: { id_token: 'google-id-token' } };
  await render();
  expect(mockCompleteGoogleLogin).toHaveBeenCalledWith('google-id-token');
});

// The paywall opens the moment sign-in completes, and the backend cold-starts —
// so the copy has to be on its way while the user is still choosing a provider.
test('warms the paywall copy on mount', async () => {
  await render();
  expect(prefetchPaywall).toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Android: expo-auth-session throws when the platform's client id is missing
// ---------------------------------------------------------------------------

const GOOGLE_UNAVAILABLE = "Google sign-in isn't available in this build.";

test('on Android without a client id the screen renders a disabled Google button instead of crashing', async () => {
  Platform.OS = 'android';
  mockGoogleIds = { ...CONFIGURED_GOOGLE_IDS, android: null };
  mockAppleAvailable = false;

  const tree = await render();

  expect(mockUseIdTokenAuthRequest).not.toHaveBeenCalled();
  expect(findButton(tree, 'Continue with Google').props.accessibilityState.disabled).toBe(true);
  expect(texts(tree)).toContain(GOOGLE_UNAVAILABLE);
});

test('on a configured Android build the Google request carries the Android client id', async () => {
  Platform.OS = 'android';
  mockAppleAvailable = false;

  const tree = await render();

  expect(mockUseIdTokenAuthRequest).toHaveBeenCalledWith(
    expect.objectContaining({ androidClientId: 'android-id', iosClientId: 'ios-id', webClientId: 'web-id' })
  );
  expect(findButton(tree, 'Continue with Google').props.accessibilityState.disabled).toBe(false);
  expect(texts(tree)).not.toContain(GOOGLE_UNAVAILABLE);
});

test('dismissing the Google sheet re-arms the nonce and leaves the buttons usable', async () => {
  const { authApi } = require('../../api/auth');
  mockResponse = { type: 'dismiss' };

  const tree = await render();

  expect(authApi.createNonce).toHaveBeenCalledTimes(2); // mount + re-arm
  expect(mockCompleteGoogleLogin).not.toHaveBeenCalled();
  expect(findButton(tree, 'Continue with Google').props.accessibilityState).toEqual({
    disabled: false,
    busy: false,
  });
});
