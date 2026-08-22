import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Overlay from '../Overlay';
import { Overlay as BarrelOverlay } from '../index';
import { overlay } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const scrim = (tree) =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.testID === 'overlay-scrim');
const scrimStyle = (tree) =>
  Object.assign({}, ...[].concat(scrim(tree).props.style).flat().filter(Boolean));
const pressScrim = (tree) =>
  tree.root
    .find((n) => n.props.testID === 'overlay-scrim' && typeof n.props.onPress === 'function')
    .props.onPress();

test('is exported from the components barrel', () => {
  expect(BarrelOverlay).toBe(Overlay);
});

test('renders nothing when not visible', () => {
  const tree = create(<Overlay visible={false} />);
  expect(tree.toJSON()).toBeNull();
});

test('uses the Figma scrim colour and opacity by default', () => {
  const s = scrimStyle(create(<Overlay onPress={() => {}} />));
  expect(s.backgroundColor).toBe(overlay.color);
  expect(s.opacity).toBe(overlay.opacity);
});

test('color and opacity are overridable', () => {
  const s = scrimStyle(create(<Overlay color="#000" opacity={0.4} onPress={() => {}} />));
  expect(s.backgroundColor).toBe('#000');
  expect(s.opacity).toBe(0.4);
});

test('tapping the scrim dismisses', () => {
  const onPress = jest.fn();
  const tree = create(<Overlay onPress={onPress} />);
  act(() => pressScrim(tree));
  expect(onPress).toHaveBeenCalled();
});

test('renders children on top of the scrim', () => {
  const tree = create(
    <Overlay onPress={() => {}}>
      <Text>Dialog</Text>
    </Overlay>
  );
  expect(tree.root.findByType(Text).props.children).toBe('Dialog');
});
