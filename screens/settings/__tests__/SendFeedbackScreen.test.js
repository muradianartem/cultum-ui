import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import SendFeedbackScreen from '../SendFeedbackScreen';
import { useAuth } from '../../../auth/AuthProvider';
import { sendFeedback } from '../../../api/feedback';

jest.mock('../../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../../../api/feedback', () => ({
  ...jest.requireActual('../../../api/feedback'),
  sendFeedback: jest.fn(),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let api;
function Probe() {
  api = useRouter();
  return null;
}

beforeEach(() => {
  useAuth.mockReturnValue({ profileEmail: 'allison@example.com' });
  sendFeedback.mockResolvedValue(undefined);
});
afterEach(() => jest.clearAllMocks());

function create() {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="settings-feedback">
          <Probe />
          <SendFeedbackScreen />
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

describe('Send feedback', () => {
  const sendButton = (tree) =>
    tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === 'Send feedback' &&
        n.props.accessibilityRole === 'button',
    );

  test('Send is disabled until there is both a topic and a message', () => {
    const tree = create();
    expect(sendButton(tree).props.accessibilityState.disabled).toBe(true);
    expect(texts(tree)).toContain("We'll reply to allison@example.com.");
  });

  test('picking a topic from the menu fills the field', () => {
    const tree = create();
    press(tree, 'Topic');
    expect(texts(tree)).toContain('Bug report');

    press(tree, 'Bug report');
    expect(texts(tree)).toContain('Bug report');
  });

  test('a complete form sends and goes back', async () => {
    const tree = create();
    press(tree, 'Topic');
    press(tree, 'Bug report');

    const area = tree.root.find(
      (n) => n.props.accessibilityLabel === 'Your message' && n.props.multiline,
    );
    act(() => area.props.onChangeText('The watering reminder never arrived.'));

    await act(async () => {
      await sendButton(tree).props.onPress();
    });

    expect(sendFeedback).toHaveBeenCalledWith({
      topic: 'bug',
      message: 'The watering reminder never arrived.',
    });
  });
});
