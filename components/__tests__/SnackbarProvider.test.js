import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  SNACK_MS,
  SnackbarProvider,
  useSnackbar,
  useSnackbarOffset,
} from '../SnackbarProvider';
import { SnackbarProvider as BarrelProvider } from '../index';

jest.useFakeTimers();

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Mount the host with a handle on `show`/`hide`, plus an optional offset. */
function mount({ offset = null } = {}) {
  const api = {};
  function Probe() {
    Object.assign(api, useSnackbar());
    return null;
  }
  function Registrar() {
    useSnackbarOffset(offset);
    return null;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <SnackbarProvider>
          <Probe />
          {offset != null ? <Registrar /> : null}
        </SnackbarProvider>
      </SafeAreaProvider>,
    );
  });
  return { tree, api };
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
// Host nodes only: the composite <Snackbar> carries the role prop too, and
// counting both would double every bar.
const bar = (tree) =>
  tree.root.findAll((n) => n.props.accessibilityRole === 'alert' && typeof n.type === 'string');
// The element owning both the label and the handler — see Snackbar.test.js.
const byLabel = (tree, label) =>
  tree.root.find(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function',
  );
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));

afterEach(() => {
  jest.clearAllTimers();
});

test('is exported from the components barrel', () => {
  expect(BarrelProvider).toBe(SnackbarProvider);
});

test('shows a message, and only one at a time', () => {
  const { tree, api } = mount();
  expect(bar(tree)).toHaveLength(0);

  act(() => api.show({ label: 'Task completed' }));
  expect(texts(tree)).toContain('Task completed');

  act(() => api.show({ label: 'Task snoozed' }));
  expect(bar(tree)).toHaveLength(1);
  expect(texts(tree)).toContain('Task snoozed');
  expect(texts(tree)).not.toContain('Task completed');

  act(() => tree.unmount());
});

test('stays up for the full window, then goes', () => {
  const { tree, api } = mount();
  act(() => api.show({ label: 'Task completed' }));

  advance(SNACK_MS - 1);
  expect(bar(tree)).toHaveLength(1);
  advance(1);
  expect(bar(tree)).toHaveLength(0);

  act(() => tree.unmount());
});

test("a replaced message's timer cannot take the newer one down", () => {
  const { tree, api } = mount();
  act(() => api.show({ label: 'First' }));
  advance(SNACK_MS - 100);
  act(() => api.show({ label: 'Second' }));

  advance(200); // past the first message's original expiry
  expect(texts(tree)).toContain('Second');

  act(() => tree.unmount());
});

test('the action runs the handler, then dismisses', () => {
  const { tree, api } = mount();
  const onPress = jest.fn();
  act(() => api.show({ label: 'Task completed', action: { label: 'Undo', onPress } }));

  act(() => byLabel(tree, 'Undo').props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(bar(tree)).toHaveLength(0);

  act(() => tree.unmount());
});

test('a message with an action carries no ✕ — the bar has no room for both', () => {
  const { tree, api } = mount();
  act(() => api.show({ label: 'Task completed', action: { label: 'Undo', onPress: () => {} } }));
  expect(() => byLabel(tree, 'Dismiss')).toThrow();

  act(() => api.show({ label: 'Plain' }));
  expect(byLabel(tree, 'Dismiss')).toBeTruthy();

  act(() => tree.unmount());
});

describe('onDismiss fires exactly once, whatever ends the message', () => {
  const cases = {
    expiry: ({ tree }) => advance(SNACK_MS),
    'the ✕': ({ tree }) => act(() => byLabel(tree, 'Dismiss').props.onPress()),
    replacement: ({ api }) => act(() => api.show({ label: 'Next' })),
    unmount: ({ tree }) => act(() => tree.unmount()),
  };

  for (const [name, end] of Object.entries(cases)) {
    test(name, () => {
      const { tree, api } = mount();
      const onDismiss = jest.fn();
      act(() => api.show({ label: 'Task completed', onDismiss }));

      end({ tree, api });
      expect(onDismiss).toHaveBeenCalledTimes(1);

      // Nothing later fires it a second time.
      advance(SNACK_MS * 2);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  }

  test('pressing the action', () => {
    const { tree, api } = mount();
    const onDismiss = jest.fn();
    const onPress = jest.fn();
    act(() =>
      api.show({ label: 'Task completed', action: { label: 'Undo', onPress }, onDismiss }),
    );

    act(() => byLabel(tree, 'Undo').props.onPress());
    // The handler lands before the dismissal that retires the undo token.
    expect(onPress.mock.invocationCallOrder[0]).toBeLessThan(
      onDismiss.mock.invocationCallOrder[0],
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);

    advance(SNACK_MS * 2);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});

describe('bottom offset', () => {
  const hostBottom = (tree) => {
    const host = tree.root.find(
      (n) => n.type === View && n.props.pointerEvents === 'box-none' && n.props.style,
    );
    return [].concat(host.props.style).find((s) => s && s.bottom != null).bottom;
  };

  test('clears whatever the screen pins to the bottom edge', () => {
    const { tree, api } = mount({ offset: 120 });
    act(() => api.show({ label: 'Task completed' }));
    expect(hostBottom(tree)).toBe(136); // 120 + 16

    act(() => tree.unmount());
  });

  test('falls back to the safe-area inset when no screen registers one', () => {
    const { tree, api } = mount();
    act(() => api.show({ label: 'Task completed' }));
    expect(hostBottom(tree)).toBe(50); // 34 + 16

    act(() => tree.unmount());
  });
});
