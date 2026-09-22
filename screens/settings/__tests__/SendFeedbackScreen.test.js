import TestRenderer, { act } from 'react-test-renderer';
import { Linking, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import SendFeedbackScreen from '../SendFeedbackScreen';
import { SnackbarProvider } from '../../../components/SnackbarProvider';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let api;
function Probe() {
  api = useRouter();
  return null;
}

let openURL;
beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

function create() {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <SnackbarProvider>
          <Router initial="settings-feedback">
            <Probe />
            <SendFeedbackScreen />
          </Router>
        </SnackbarProvider>
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
        n.props.accessibilityLabel === 'Email feedback' &&
        n.props.accessibilityRole === 'button',
    );

  test('Send is disabled until there is both a topic and a message', () => {
    const tree = create();
    expect(sendButton(tree).props.accessibilityState.disabled).toBe(true);
    expect(texts(tree)).toContain('Opens your mail app, addressed to hello@cultum.app.');
  });

  test('picking a topic from the menu fills the field', () => {
    const tree = create();
    press(tree, 'Topic');
    expect(texts(tree)).toContain('Bug report');

    press(tree, 'Bug report');
    expect(texts(tree)).toContain('Bug report');
  });

  const fill = (tree) => {
    press(tree, 'Topic');
    press(tree, 'Bug report');
    const area = tree.root.find(
      (n) => n.props.accessibilityLabel === 'Your message' && n.props.multiline,
    );
    act(() => area.props.onChangeText('The watering reminder never arrived & I checked?'));
  };
  const send = (tree) =>
    act(async () => {
      await sendButton(tree).props.onPress();
    });

  test('a complete form opens Mail, addressed to support, with the message', async () => {
    const tree = create();
    fill(tree);
    await send(tree);

    expect(openURL).toHaveBeenCalledTimes(1);
    const [url] = openURL.mock.calls[0];
    expect(url.startsWith('mailto:hello@cultum.app?subject=')).toBe(true);
    expect(url).toContain(encodeURIComponent('The watering reminder never arrived & I checked?'));
  });

  test('nothing claims it was sent, and the screen stays put', async () => {
    const tree = create();
    fill(tree);
    await send(tree);

    expect(api.route).toBe('settings-feedback');
    expect(texts(tree).some((t) => /on its way|sent/i.test(String(t)))).toBe(false);
  });

  test('when Mail cannot open, it says where to write and keeps the draft', async () => {
    openURL.mockRejectedValue(new Error('no mail app'));
    const tree = create();
    fill(tree);
    await send(tree);

    expect(texts(tree)).toContain("Couldn't open Mail. You can reach us at hello@cultum.app");
    expect(api.route).toBe('settings-feedback');
    const area = tree.root.find((n) => n.props.accessibilityLabel === 'Your message' && n.props.multiline);
    expect(area.props.value).toBe('The watering reminder never arrived & I checked?');
    expect(sendButton(tree).props.accessibilityState.disabled).toBe(false);
  });

  test('"Other ways to contact us" opens Contact us', () => {
    const tree = create();
    press(tree, 'Other ways to contact us');
    expect(api.route).toBe('settings-contact');
  });
});
