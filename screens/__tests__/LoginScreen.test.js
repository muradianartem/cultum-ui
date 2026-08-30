import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

// --- Mock the native / async edges the Login screen depends on ---
const mockPromptAsync = jest.fn(async () => ({ type: 'dismiss' }));
let mockResponse = null; // per-test override of the auth-request response
jest.mock('expo-auth-session', () => ({
  __esModule: true,
  ResponseType: { IdToken: 'id_token' },
  useAutoDiscovery: () => ({ authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }),
  makeRedirectUri: () => 'cultum://redirect',
  useAuthRequest: () => [{ /* request */ }, mockResponse, mockPromptAsync],
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

const pressButton = (tree, label) =>
  tree.root
    .find(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label
    )
    .props.onPress();

test('renders the Google and Apple continue buttons', async () => {
  const tree = await render();
  expect(texts(tree)).toContain('Continue with Google');
  expect(texts(tree)).toContain('Continue with Apple');
});

test('pressing Apple shows a coming-soon snackbar and makes no auth call', async () => {
  const { authApi } = require('../../api/auth');
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
