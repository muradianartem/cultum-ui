import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../routing';
import SettingsScreen from '../SettingsScreen';
import { useAuth } from '../../auth/AuthProvider';

// Stub the auth context — this screen only consumes signOut().
jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));

// Insets need a provider; feed fixed metrics so useSafeAreaInsets resolves.
const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let signOut;
let api;
function Probe() {
  api = useRouter();
  return null;
}

beforeEach(() => {
  signOut = jest.fn().mockResolvedValue(undefined);
  useAuth.mockReturnValue({ signOut });
});

afterEach(() => jest.clearAllMocks());

function create() {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="settings">
          <Probe />
          <SettingsScreen />
        </Router>
      </SafeAreaProvider>
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

// Fire the onPress of the composite node carrying `label` (Pressable exposes
// onPress on its node; the host it renders carries the resolved styles).
const press = (tree, label) => {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label
  );
  act(() => node.props.onPress());
};

const dialogVisible = (tree, testID) =>
  tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

test('renders a Log out row with the dialog hidden', () => {
  const tree = create();
  expect(texts(tree)).toContain('Log out');
  expect(dialogVisible(tree, 'logout-dialog')).toBe(false);
});

test('pressing Log out opens the confirm dialog without signing out', () => {
  const tree = create();
  press(tree, 'Log out'); // the list row
  expect(dialogVisible(tree, 'logout-dialog')).toBe(true);
  expect(texts(tree)).toContain('Log out?'); // dialog title
  expect(signOut).not.toHaveBeenCalled();
});

test('confirming the dialog calls signOut once', async () => {
  const tree = create();
  press(tree, 'Log out'); // open

  // Both the row and the dialog's primary action carry the "Log out" label;
  // the dialog's is the last one mounted.
  const buttons = tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === 'Log out'
  );
  await act(async () => {
    await buttons[buttons.length - 1].props.onPress();
  });

  expect(signOut).toHaveBeenCalledTimes(1);
});

test('Cancel closes the dialog without signing out', () => {
  const tree = create();
  press(tree, 'Log out');
  expect(dialogVisible(tree, 'logout-dialog')).toBe(true);

  press(tree, 'Cancel');
  expect(dialogVisible(tree, 'logout-dialog')).toBe(false);
  expect(signOut).not.toHaveBeenCalled();
});

test('the Settings tab is the active one, and Today navigates home', () => {
  const tree = create();
  const settingsTab = tree.root.find(
    (n) =>
      typeof n.type === 'string' &&
      n.props.accessibilityRole === 'tab' &&
      n.props.accessibilityLabel === 'Settings'
  );
  expect(settingsTab.props.accessibilityState.selected).toBe(true);

  press(tree, 'Today');
  expect(api.route).toBe('today');
});
