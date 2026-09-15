import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Router } from '../../../routing';
import ContactUsScreen from '../ContactUsScreen';

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
        <Router initial="settings-contact">
          <ContactUsScreen />
        </Router>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

test('copying the address confirms on the button itself', async () => {
  // The design puts the confirmation on the control rather than in a snackbar,
  // which is also the only place the user is looking.
  const tree = create();
  expect(texts(tree)).toContain('hello@cultum.app');
  expect(texts(tree)).toContain('Copy Email Address');

  await act(async () => {
    await tree.root
      .find(
        (n) =>
          typeof n.props.onPress === 'function' &&
          n.props.accessibilityLabel === 'Copy Email Address',
      )
      .props.onPress();
  });

  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('hello@cultum.app');
  expect(texts(tree)).toContain('Email Copied');
});
