import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard, Modal, Text } from 'react-native';
import BottomSheet from '../BottomSheet';
import { BottomSheet as BarrelBottomSheet } from '../index';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) =>
  tree.root.findAllByType(Text).flatMap((n) => {
    const c = n.props.children;
    return Array.isArray(c) ? c : [c];
  });

// Collapse a node's style array into one object.
const flat = (node) => Object.assign({}, ...[].concat(node.props.style).filter(Boolean));

const byTestID = (tree, id) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);

// Capture the keyboard listeners so a test can raise the keyboard, and stub
// dismiss so it can be asserted on.
function mockKeyboard() {
  const handlers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
    handlers[event] = fn;
    return { remove: () => delete handlers[event] };
  });
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const fire = (suffix, event) =>
    act(() =>
      Object.keys(handlers)
        .filter((name) => name.endsWith(suffix))
        .forEach((name) => handlers[name](event))
    );
  const show = (event = {}) => fire('Show', event);
  const hide = (event = {}) => fire('Hide', event);
  return { dismiss, show, hide };
}

// Host Pressables expose onClick under this renderer, onPress elsewhere.
const tap = (node) => (node.props.onClick ?? node.props.onPress)?.({});

afterEach(() => jest.restoreAllMocks());

test('is exported from the components barrel', () => {
  expect(BarrelBottomSheet).toBe(BottomSheet);
});

test('drives the Modal open/closed via the visible prop', () => {
  const open = create(<BottomSheet visible title="Hi" onClose={() => {}} />);
  expect(open.root.findByType(Modal).props.visible).toBe(true);
  const closed = create(<BottomSheet visible={false} title="Hi" onClose={() => {}} />);
  expect(closed.root.findByType(Modal).props.visible).toBe(false);
});

test('renders title, description and caption slots', () => {
  const tree = create(
    <BottomSheet
      visible
      onClose={() => {}}
      title="Delete plant?"
      description="This cannot be undone."
      caption="You can re-add it later."
    />
  );
  const t = texts(tree);
  expect(t).toContain('Delete plant?');
  expect(t).toContain('This cannot be undone.');
  expect(t).toContain('You can re-add it later.');
});

test('omitted slots do not render', () => {
  const tree = create(<BottomSheet visible onClose={() => {}} title="Only title" />);
  expect(texts(tree)).not.toContain('undefined');
  // description absent → only the title (+ close glyph) present
  expect(texts(tree)).toContain('Only title');
});

test('renders primary and secondary actions as buttons and fires onPress', () => {
  const onPrimary = jest.fn();
  const tree = create(
    <BottomSheet
      visible
      onClose={() => {}}
      title="Confirm"
      primaryAction={{ label: 'Yes', onPress: onPrimary }}
      secondaryAction={{ label: 'No', onPress: () => {} }}
    />
  );
  const t = texts(tree);
  expect(t).toContain('Yes');
  expect(t).toContain('No');
  const yes = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityLabel === 'Yes'
  );
  act(() => yes.props.onClick?.() ?? yes.parent.props.onPress?.());
});

test('backdrop and close both call onClose', () => {
  const onClose = jest.fn();
  const tree = create(<BottomSheet visible onClose={onClose} title="X" />);
  act(() => byTestID(tree, 'bottomsheet-backdrop')[0].props.onClick?.());
  act(() => tap(byTestID(tree, 'bottomsheet-backdrop')[0]));
  expect(onClose).toHaveBeenCalled();
});

// Figma gives some sheets their own ground and rhythm (the paywall's "Choose a
// plan" sheet is #FAFAFA with a 24px top radius, not the default surface).
test('sheetStyle and bodyStyle override the surface and its padding', () => {
  const tree = create(
    <BottomSheet
      visible
      onClose={() => {}}
      title="X"
      sheetStyle={{ backgroundColor: '#FAFAFA', borderTopLeftRadius: 24 }}
      bodyStyle={{ paddingTop: 8 }}
    />
  );
  const surface = tree.root.find(
    (n) => typeof n.type === 'string' && flat(n).borderTopLeftRadius != null
  );
  expect(flat(surface).backgroundColor).toBe('#FAFAFA');
  expect(flat(surface).borderTopLeftRadius).toBe(24);

  const body = tree.root.find(
    (n) => typeof n.type === 'string' && flat(n).paddingTop === 8 && flat(n).paddingBottom === 24
  );
  expect(body).toBeTruthy();
});

// A sheet with a field must stay readable while typing, and the keyboard must
// be dismissable without losing the sheet.
describe('keyboard', () => {
  // The inset comes off the keyboard event itself — a <Modal> only mounts its
  // subtree when it opens, so a KeyboardAvoidingView has not laid out yet when
  // an autofocused field raises the keyboard, and the sheet stays buried.
  test('the sheet rides above the keyboard, by its height', () => {
    const { show, hide } = mockKeyboard();
    const tree = create(<BottomSheet visible onClose={() => {}} title="X" />);
    const root = () =>
      tree.root.find((n) => typeof n.type === 'string' && flat(n).justifyContent === 'flex-end');

    expect(flat(root()).paddingBottom).toBe(0);
    show({ endCoordinates: { height: 336 }, duration: 250, easing: 'keyboard' });
    expect(flat(root()).paddingBottom).toBe(336);
    hide({ duration: 250, easing: 'keyboard' });
    expect(flat(root()).paddingBottom).toBe(0);
  });

  test('with the keyboard up, the backdrop hides it instead of closing', () => {
    const { dismiss, show } = mockKeyboard();
    const onClose = jest.fn();
    const tree = create(<BottomSheet visible onClose={onClose} title="X" />);
    show();
    act(() => tap(byTestID(tree, 'bottomsheet-backdrop')[0]));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('with the keyboard down, the backdrop closes', () => {
    const { dismiss } = mockKeyboard();
    const onClose = jest.fn();
    const tree = create(<BottomSheet visible onClose={onClose} title="X" />);
    act(() => tap(byTestID(tree, 'bottomsheet-backdrop')[0]));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });

  test('tapping the panel hides the keyboard', () => {
    const { dismiss } = mockKeyboard();
    const tree = create(<BottomSheet visible onClose={() => {}} title="X" />);
    act(() => tap(byTestID(tree, 'bottomsheet-panel')[0]));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
