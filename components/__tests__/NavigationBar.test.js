import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import NavigationBar from '../NavigationBar';
import { NavigationBar as BarrelNav } from '../index';
import { divider } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
const byLabel = (tree, label) =>
  tree.root.find(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function'
  );
const header = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'header'
  );

test('is exported from the components barrel', () => {
  expect(BarrelNav).toBe(NavigationBar);
});

test('renders title and subtitle', () => {
  const tree = create(<NavigationBar title="My Plants" subtitle="12 items" />);
  expect(texts(tree)).toContain('My Plants');
  expect(texts(tree)).toContain('12 items');
});

test('back leading fires onLeadingPress', () => {
  const onLeadingPress = jest.fn();
  const tree = create(<NavigationBar title="x" leading="back" onLeadingPress={onLeadingPress} />);
  act(() => byLabel(tree, 'Back').props.onPress());
  expect(onLeadingPress).toHaveBeenCalled();
});

test('close leading is labelled Close', () => {
  const tree = create(<NavigationBar title="x" leading="close" onLeadingPress={() => {}} />);
  expect(byLabel(tree, 'Close')).toBeTruthy();
});

test('renders up to two trailing actions and fires them', () => {
  const a1 = jest.fn();
  const tree = create(
    <NavigationBar
      title="x"
      actions={[
        { icon: <Text>a</Text>, onPress: a1, accessibilityLabel: 'Share' },
        { icon: <Text>b</Text>, onPress: () => {}, accessibilityLabel: 'More' },
        { icon: <Text>c</Text>, onPress: () => {}, accessibilityLabel: 'Extra' },
      ]}
    />
  );
  expect(byLabel(tree, 'Share')).toBeTruthy();
  expect(byLabel(tree, 'More')).toBeTruthy();
  expect(() => byLabel(tree, 'Extra')).toThrow(); // capped at 2
  act(() => byLabel(tree, 'Share').props.onPress());
  expect(a1).toHaveBeenCalled();
});

test('divider is on by default and can be turned off', () => {
  const withD = Object.assign({}, ...[].concat(header(create(<NavigationBar title="x" />)).props.style).filter(Boolean));
  expect(withD.borderBottomColor).toBe(divider.hairline);
  const noD = Object.assign({}, ...[].concat(header(create(<NavigationBar title="x" divider={false} />)).props.style).filter(Boolean));
  expect(noD.borderBottomColor).toBeUndefined();
});
