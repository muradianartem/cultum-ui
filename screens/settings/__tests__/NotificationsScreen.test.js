import TestRenderer, { act } from 'react-test-renderer';
import { Linking, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Router } from '../../../routing';
import NotificationsScreen from '../NotificationsScreen';
import { usePrefs } from '../../../prefs';
import { useAuth } from '../../../auth/AuthProvider';
import { useGarden } from '../../../store/GardenProvider';
import ReminderTimeSheet from '../ReminderTimeSheet';

jest.mock('../../../prefs', () => ({ usePrefs: jest.fn() }));
jest.mock('../../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../../../store/GardenProvider', () => ({ useGarden: jest.fn() }));

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let prefs;
let retimeAllReminders;

beforeEach(() => {
  retimeAllReminders = jest.fn();
  prefs = {
    notificationsEnabled: true,
    notificationPermission: 'granted',
    reminderTime: '09:00',
    setNotificationsEnabled: jest.fn(),
    setReminderTime: jest.fn(),
  };
  usePrefs.mockImplementation(() => prefs);
  useAuth.mockReturnValue({ profileEmail: 'allison@example.com' });
  useGarden.mockReturnValue({ retimeAllReminders });
  jest.spyOn(Linking, 'openSettings').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function create() {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Router initial="settings-notifications">
          <NotificationsScreen />
        </Router>
      </SafeAreaProvider>,
    );
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => [].concat(n.props.children));

const toggle = (tree, label) =>
  tree.root.find(
    (n) => n.props.accessibilityRole === 'switch' && n.props.accessibilityLabel === label,
  );

test('renders both sections and the current reminder time', () => {
  const t = texts(create());
  expect(t).toContain('Where they arrive');
  expect(t).toContain('When they arrive');
  expect(t).toContain('Reminder time');
  expect(t).toContain('9:00 AM');
  expect(t).toContain('The same nudge, to allison@example.com');
});

test('the email toggle is disabled — there is no endpoint behind it', () => {
  const tree = create();
  expect(toggle(tree, 'Email notifications').props.accessibilityState.disabled).toBe(true);
});

test('the app toggle reflects the preference and writes to it', () => {
  const tree = create();
  expect(toggle(tree, 'App notifications').props.accessibilityState.checked).toBe(true);

  act(() => toggle(tree, 'App notifications').props.onPress());
  expect(prefs.setNotificationsEnabled).toHaveBeenCalledWith(false);
});

test('a permission the OS has refused reads as off, whatever the preference says', () => {
  // The preference stays true — that is intent, and it is what makes allowing
  // it later in iOS Settings just work — but a switch reading "on" while
  // nothing is ever delivered would be a lie.
  prefs = { ...prefs, notificationsEnabled: true, notificationPermission: 'denied' };
  const tree = create();

  expect(toggle(tree, 'App notifications').props.accessibilityState.checked).toBe(false);
  expect(texts(tree)).toContain('Blocked in iOS Settings — tap to allow');

  act(() => toggle(tree, 'App notifications').props.onPress());
  expect(Linking.openSettings).toHaveBeenCalled();
  expect(prefs.setNotificationsEnabled).not.toHaveBeenCalled();
});

test('confirming a new time saves the default and re-times every reminder', () => {
  const tree = create();
  const sheet = tree.root.findByType(ReminderTimeSheet);

  act(() => sheet.props.onConfirm('07:30'));

  expect(prefs.setReminderTime).toHaveBeenCalledWith('07:30');
  expect(retimeAllReminders).toHaveBeenCalledWith('07:30');
});
