import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import List from '../List';
import ListItem from '../ListItem';
import { List as BarrelList, ListItem as BarrelItem } from '../index';
import { list, divider } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
const views = (tree) =>
  tree.root.findAll((n) => typeof n.type === 'string' && n.type === 'View');
const flat = (n) => Object.assign({}, ...[].concat(n.props.style).filter(Boolean));

test('List and ListItem are exported from the barrel', () => {
  expect(BarrelList).toBe(List);
  expect(BarrelItem).toBe(ListItem);
});

test('ListItem renders title, subtitle, before and after slots', () => {
  const tree = create(
    <ListItem
      title="Monstera"
      subtitle="Water in 2 days"
      before={<View testID="ic" />}
      after={<View testID="chk" />}
    />
  );
  expect(texts(tree)).toContain('Monstera');
  expect(texts(tree)).toContain('Water in 2 days');
  expect(
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'ic')
  ).toHaveLength(1);
  expect(
    tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'chk')
  ).toHaveLength(1);
});

test('divider draws a hairline when requested', () => {
  const withD = create(<ListItem title="x" divider />);
  expect(views(withD).some((v) => flat(v).backgroundColor === divider.hairline)).toBe(true);
  const noD = create(<ListItem title="x" />);
  expect(views(noD).some((v) => flat(v).backgroundColor === divider.hairline)).toBe(false);
});

test('onPress makes the row a button that fires', () => {
  const onPress = jest.fn();
  const tree = create(<ListItem title="Tap me" onPress={onPress} />);
  const row = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button'
  );
  expect(row).toBeTruthy();
  const composite = tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button'
  );
  act(() => composite.props.onPress());
  expect(onPress).toHaveBeenCalled();
});

test('card List wraps items in the grey panel and propagates variant', () => {
  const tree = create(
    <List variant="card">
      <ListItem title="A" />
      <ListItem title="B" />
    </List>
  );
  const root = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'list'
  );
  expect(flat(root).backgroundColor).toBe(list.cardBg);
});
