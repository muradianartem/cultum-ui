import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

// --- Mock the native / async edges the Login screen depends on ---
const mockPromptAsync = jest.fn(async () => ({ type: 'dismiss' }));
let mockResponse = null; // per-test override of the auth-request response
// The screen imports the Google *provider* entry point, not the base module —
// mocking 'expo-auth-session' alone leaves the real provider running (and it
// throws on a missing iosClientId under jest).
jest.mock('expo-auth-session/providers/google', () => ({
  __esModule: true,
  useIdTokenAuthRequest: () => [{ /* request */ }, mockResponse, mockPromptAsync],
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
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
const mockCompleteGoogleLogin = jest.fn(async () => {});
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ completeGoogleLogin: mockCompleteGoogleLogin, status: 'signedOut' }),
}));

import LoginScreen from '../LoginScreen';

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

test('pressing Apple shows a coming-soon snackbar and makes no auth call', async () => {
  const tree = await render();
  expect(texts(tree)).not.toContain('Apple Sign In is coming soon');

  await act(async () => {
    pressButton(tree, 'Continue with Apple');
  });

  expect(texts(tree)).toContain('Apple Sign In is coming soon');
  expect(mockPromptAsync).not.toHaveBeenCalled();
});

test('a successful Google response exchanges the id_token via completeGoogleLogin', async () => {
  mockResponse = { type: 'success', params: { id_token: 'google-id-token' } };
  await render();
  expect(mockCompleteGoogleLogin).toHaveBeenCalledWith('google-id-token');
});
