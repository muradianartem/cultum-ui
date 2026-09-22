import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard, Text } from 'react-native';
import { useKeyboard, useKeyboardVisible } from '../useKeyboardVisible';
import { useKeyboard as BarrelUseKeyboard } from '../index';

// Capture the listeners so a test can raise and drop the keyboard by hand.
function mockKeyboard({ isVisible = false, metrics = null } = {}) {
  const handlers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
    handlers[event] = fn;
    return { remove: () => delete handlers[event] };
  });
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(isVisible);
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(metrics);
  const fire = (suffix, event) =>
    act(() =>
      Object.keys(handlers)
        .filter((name) => name.endsWith(suffix))
        .forEach((name) => handlers[name](event))
    );
  return {
    handlers,
    show: (event = {}) => fire('Show', event),
    hide: (event = {}) => fire('Hide', event),
  };
}

// Render the hook and report what it returns on every pass.
function render(hook) {
  const seen = [];
  function Probe() {
    seen.push(hook());
    return <Text>probe</Text>;
  }
  let tree;
  act(() => {
    tree = TestRenderer.create(<Probe />);
  });
  return { tree, last: () => seen[seen.length - 1] };
}

afterEach(() => jest.restoreAllMocks());

test('is exported from the components barrel', () => {
  expect(BarrelUseKeyboard).toBe(useKeyboard);
});

test('starts from the keyboard already on screen', () => {
  mockKeyboard({ isVisible: true, metrics: { height: 291 } });
  const { last } = render(useKeyboard);
  expect(last()).toEqual({ visible: true, height: 291 });
});

test('starts empty with the keyboard down, ignoring stale metrics', () => {
  mockKeyboard({ isVisible: false, metrics: { height: 291 } });
  const { last } = render(useKeyboard);
  expect(last()).toEqual({ visible: false, height: 0 });
});

test('takes its height from the keyboard frame, and drops it on hide', () => {
  const { show, hide } = mockKeyboard();
  const { last } = render(useKeyboard);

  show({ endCoordinates: { height: 336 }, duration: 250, easing: 'keyboard' });
  expect(last()).toEqual({ visible: true, height: 336 });

  hide({ duration: 250, easing: 'keyboard' });
  expect(last()).toEqual({ visible: false, height: 0 });
});

// A hardware keyboard is up with only an accessory bar, so "visible" cannot be
// a function of the height — the backdrop still has to dismiss it first.
test('is visible even when the frame carries no height', () => {
  const { show } = mockKeyboard();
  const { last } = render(useKeyboardVisible);
  show({});
  expect(last()).toBe(true);
});

test('unsubscribes on unmount', () => {
  const { handlers } = mockKeyboard();
  const { tree } = render(useKeyboard);
  expect(Object.keys(handlers)).toHaveLength(2);
  act(() => tree.unmount());
  expect(Object.keys(handlers)).toHaveLength(0);
});
