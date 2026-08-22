import TestRenderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import Avatar, { AvatarGroup } from '../Avatar';
import { Avatar as BarrelAvatar, AvatarGroup as BarrelGroup } from '../index';
import { avatar } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const box = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'image'
  );
const boxStyle = (t) => Object.assign({}, ...[].concat(t.props.style).flat().filter(Boolean));

test('Avatar and AvatarGroup are exported', () => {
  expect(BarrelAvatar).toBe(Avatar);
  expect(BarrelGroup).toBe(AvatarGroup);
});

test('initials render when there is no source', () => {
  const tree = create(<Avatar initials="JD" />);
  expect(tree.root.findByType(Text).props.children).toBe('JD');
});

test('photo renders an Image and no text', () => {
  const tree = create(<Avatar source="https://example.com/a.png" initials="JD" />);
  expect(tree.root.findAllByType(Image)).toHaveLength(1);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
});

test('overflow renders +N and is labelled for a11y', () => {
  const tree = create(<Avatar overflow={9} />);
  const t = tree.root.findByType(Text);
  expect(t.props.children).toEqual(['+', 9]);
  expect(box(create(<Avatar overflow={9} />)).props.accessibilityLabel).toBe('9 more');
});

test('size maps to the Figma diameters (xs24/sm32/md40/lg56)', () => {
  expect(boxStyle(box(create(<Avatar initials="A" size="xs" />))).width).toBe(24);
  expect(boxStyle(box(create(<Avatar initials="A" size="sm" />))).width).toBe(32);
  expect(boxStyle(box(create(<Avatar initials="A" size="md" />))).width).toBe(40);
  expect(boxStyle(box(create(<Avatar initials="A" size="lg" />))).width).toBe(56);
});

test('AvatarGroup collapses extras into a +N overflow', () => {
  const tree = create(
    <AvatarGroup max={2} avatars={[{ initials: 'A' }, { initials: 'B' }, { initials: 'C' }, { initials: 'D' }]} />
  );
  // 2 shown + 1 overflow; overflow text is "+2"
  const texts = tree.root.findAllByType(Text).map((n) => n.props.children);
  expect(texts).toContainEqual(['+', 2]);
});
