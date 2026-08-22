import TestRenderer, { act } from 'react-test-renderer';
import { View, ActivityIndicator } from 'react-native';
import ButtonIcon from '../ButtonIcon';
import { ButtonIcon as BarrelButtonIcon } from '../index';
import { button } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const btn = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button'
  );
const btnStyle = (tree) =>
  Object.assign({}, ...[].concat(btn(tree).props.style).filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelButtonIcon).toBe(ButtonIcon);
});

test('renders the icon node and forwards the a11y label', () => {
  const tree = create(
    <ButtonIcon icon={<View testID="glyph" />} accessibilityLabel="Add" />
  );
  expect(
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'glyph')
  ).toHaveLength(1);
  expect(btn(tree).props.accessibilityLabel).toBe('Add');
});

test('reuses the button colours (primary green) and is square', () => {
  const tree = create(<ButtonIcon accessibilityLabel="x" icon={<View />} />);
  const s = btnStyle(tree);
  expect(s.backgroundColor).toBe(button.primary.bg);
  expect(s.width).toBe(s.height);
});

test('size maps to Figma square dims (lg 48 / md 40 / sm 32)', () => {
  expect(btnStyle(create(<ButtonIcon size="lg" accessibilityLabel="a" icon={<View />} />)).width).toBe(48);
  expect(btnStyle(create(<ButtonIcon size="md" accessibilityLabel="a" icon={<View />} />)).width).toBe(40);
  expect(btnStyle(create(<ButtonIcon size="sm" accessibilityLabel="a" icon={<View />} />)).width).toBe(32);
});

test('destructive outline draws the red border', () => {
  const tree = create(
    <ButtonIcon variant="outline" destructive accessibilityLabel="Del" icon={<View />} />
  );
  const s = btnStyle(tree);
  expect(s.borderWidth).toBe(1);
  expect(s.borderColor).toBe(button.dangerOutline.border);
});

test('loading shows a spinner and marks busy', () => {
  const tree = create(<ButtonIcon loading accessibilityLabel="x" icon={<View />} />);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(btn(tree).props.accessibilityState.busy).toBe(true);
});
