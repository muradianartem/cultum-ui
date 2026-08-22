import TestRenderer, { act } from 'react-test-renderer';
import { Modal, Text, Pressable } from 'react-native';
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

const byTestID = (tree, id) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);

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
  act(() => byTestID(tree, 'bottomsheet-backdrop')[0].props.onPress?.());
  expect(onClose).toHaveBeenCalled();
});
