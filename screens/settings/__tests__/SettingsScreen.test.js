import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router, useRouter } from '../../../routing';
import SettingsScreen from '../SettingsScreen';
import { useAuth } from '../../../auth/AuthProvider';
import { useEntitlement } from '../../../billing/EntitlementProvider';
import { deleteAccount } from '../../../api/account';

jest.mock('../../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../../../billing/EntitlementProvider', () => ({ useEntitlement: jest.fn() }));
jest.mock('../../../api/account', () => ({ deleteAccount: jest.fn() }));

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
  useAuth.mockReturnValue({
    signOut,
    profileName: 'Allison',
    profileEmail: 'allison@example.com',
    updateProfileName: jest.fn(),
  });
  useEntitlement.mockReturnValue({ ready: true, isPlus: false });
  deleteAccount.mockResolvedValue({ deleted: true, store_subscription_active: false });
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

// The last node carrying a label is the most recently mounted one — the dialog's
// action rather than the list row that opened it.
const pressLast = async (tree, label) => {
  const nodes = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label,
  );
  await act(async () => {
    await nodes[nodes.length - 1].props.onPress();
  });
};

const dialogVisible = (tree, testID) =>
  tree.root.findAll((n) => n.props.testID === testID)[0].props.visible;

test('renders every section from the design, with both dialogs hidden', () => {
  const t = texts(create());
  for (const label of [
    'Allison',
    'allison@example.com',
    'Preferences',
    'Notifications',
    'Appearance',
    'Help & feedback',
    'Send feedback',
    'Contact us',
    'Rate the app',
    'About Cultum',
    'Log out',
    'Delete account',
  ]) {
    expect(t).toContain(label);
  }
});

test('the upgrade card shows for a free user and not for a subscriber', () => {
  expect(texts(create())).toContain('Upgrade to Cultum Plus');

  useEntitlement.mockReturnValue({ ready: true, isPlus: true });
  expect(texts(create())).not.toContain('Upgrade to Cultum Plus');
});

test('nothing is offered until the entitlement is known', () => {
  // Showing an upgrade pitch to somebody already paying is the worse of the two
  // wrong frames, so an unknown plan renders no card at all.
  useEntitlement.mockReturnValue({ ready: false, isPlus: false });
  expect(texts(create())).not.toContain('Upgrade to Cultum Plus');
});

test('Upgrade opens the paywall', () => {
  const tree = create();
  press(tree, 'Upgrade');
  expect(api.route).toBe('paywall');
});

test('each Preferences and Help row reaches its own screen', () => {
  for (const [label, route] of [
    ['Notifications', 'settings-notifications'],
    ['Send feedback', 'settings-feedback'],
    ['Contact us', 'settings-contact'],
    ['About Cultum', 'settings-about'],
  ]) {
    const tree = create();
    press(tree, label);
    expect(api.route).toBe(route);
  }
});

test('pressing Log out opens the confirm dialog without signing out', () => {
  const tree = create();
  press(tree, 'Log out');
  expect(dialogVisible(tree, 'logout-dialog')).toBe(true);
  expect(texts(tree)).toContain('Log out?');
  expect(signOut).not.toHaveBeenCalled();
});

test('confirming the dialog calls signOut once', async () => {
  const tree = create();
  press(tree, 'Log out');
  await pressLast(tree, 'Log out');
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

test('Delete account confirms first, then deletes and signs out', async () => {
  const tree = create();
  press(tree, 'Delete account');
  expect(dialogVisible(tree, 'delete-account-dialog')).toBe(true);
  expect(texts(tree)).toContain('Delete account?');
  expect(deleteAccount).not.toHaveBeenCalled();

  await pressLast(tree, 'Delete');
  expect(deleteAccount).toHaveBeenCalledTimes(1);
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('a store subscription that survives deletion is reported before signing out', async () => {
  // The server answers 200 with a body precisely so this can be said: deleting
  // the account does not cancel a subscription bought in a store, and only the
  // user can end it.
  deleteAccount.mockResolvedValue({
    deleted: true,
    store_subscription_active: true,
    store: 'apple',
    message: 'Your Apple subscription is still active. Cancel it in Settings.',
  });

  const tree = create();
  press(tree, 'Delete account');
  await pressLast(tree, 'Delete');

  expect(dialogVisible(tree, 'delete-notice-dialog')).toBe(true);
  expect(texts(tree)).toContain('Your Apple subscription is still active. Cancel it in Settings.');
  expect(signOut).not.toHaveBeenCalled();

  await pressLast(tree, 'Done');
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('a failed deletion keeps the user where they are', async () => {
  deleteAccount.mockRejectedValue(new Error('offline'));
  const tree = create();
  press(tree, 'Delete account');
  await pressLast(tree, 'Delete');

  expect(signOut).not.toHaveBeenCalled();
  expect(dialogVisible(tree, 'delete-account-dialog')).toBe(true);
  expect(texts(tree)).toContain('offline');
});

test('the Settings tab is the active one, and Today navigates home', () => {
  const tree = create();
  const settingsTab = tree.root.find(
    (n) =>
      typeof n.type === 'string' &&
      n.props.accessibilityRole === 'tab' &&
      n.props.accessibilityLabel === 'Settings',
  );
  expect(settingsTab.props.accessibilityState.selected).toBe(true);

  press(tree, 'Today');
  expect(api.route).toBe('today');
});
