import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Router } from '../../../routing';
import AboutScreen from '../AboutScreen';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => {}) }));

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

afterEach(() => jest.clearAllMocks());

function create() {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="settings-about">
          <AboutScreen />
        </Router>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

const press = (tree, label) => {
  const node = tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label,
  );
  act(() => node.props.onPress());
};

describe('About', () => {
  test('states what this build is, from the native bundle', () => {
    const t = texts(create());
    expect(t).toContain('Version');
    expect(t).toContain('1.0.6');
    expect(t).toContain('Build');
    expect(t).toContain('42');
    expect(t).toContain('Released');
  });

  test('legal links open in the in-app browser, not Safari', () => {
    const tree = create();
    press(tree, 'Privacy Policy');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://cultum.app/privacy');
  });
});
