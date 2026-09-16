// Dark-mode rendering for the primitives that make up most of a screen: each one
// must take its colours from the active theme, so inside a dark provider it
// resolves the dark half of the same semantic role it uses in light.

import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import { colorTokens, interaction } from '../../theme/colorTokens';
import { ThemeProvider, resolveTokens } from '../../theme/ThemeProvider';
import Card from '../Card';
import ListItem from '../ListItem';
import BottomSheet from '../BottomSheet';
import TabBar from '../TabBar';
import Snackbar from '../Snackbar';
import TextInput from '../TextInput';

const dark = resolveTokens({ ...colorTokens, interaction }, 'dark');
const light = resolveTokens({ ...colorTokens, interaction }, 'light');

function renderDark(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(<ThemeProvider mode="dark">{el}</ThemeProvider>);
  });
  return tree;
}

const flat = (node) => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean));
const hostByRole = (tree, role) =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === role);
const textNode = (tree, copy) =>
  tree.root.findAll((n) => n.type === Text && n.props.children === copy)[0];

test('dark and light really differ for the roles asserted below', () => {
  expect(dark.surface.primary).not.toBe(light.surface.primary);
  expect(dark.background.primary).not.toBe(light.background.primary);
  expect(dark.text.primary).not.toBe(light.text.primary);
});

test('Card sits on the dark surface with light copy', () => {
  const tree = renderDark(<Card title="Monstera" subtitle="Needs water" />);
  expect(flat(hostByRole(tree, 'none')).backgroundColor).toBe(dark.surface.primary);
  expect(flat(textNode(tree, 'Monstera')).color).toBe(dark.text.primary);
  expect(flat(textNode(tree, 'Needs water')).color).toBe(dark.text.secondary);
});

test('ListItem title, subtitle and divider follow the dark theme', () => {
  const tree = renderDark(<ListItem title="Water" subtitle="Monstera" divider />);
  expect(flat(textNode(tree, 'Water')).color).toBe(dark.text.primary);
  expect(flat(textNode(tree, 'Monstera')).color).toBe(dark.text.secondary);
  const divider = tree.root.find(
    (n) => typeof n.type === 'string' && flat(n).height === 1 && flat(n).position === 'absolute'
  );
  expect(flat(divider).backgroundColor).toBe(dark.border.primary);
});

test('BottomSheet surface and copy follow the dark theme', () => {
  const tree = renderDark(<BottomSheet visible onClose={() => {}} title="Delete plant?" />);
  const surface = tree.root.find(
    (n) => typeof n.type === 'string' && flat(n).borderTopLeftRadius != null
  );
  expect(flat(surface).backgroundColor).toBe(dark.background.secondary);
  expect(flat(textNode(tree, 'Delete plant?')).color).toBe(dark.text.primary);
});

test('TabBar is the dark page ground with a dark hairline', () => {
  const tree = renderDark(
    <TabBar
      value="today"
      tabs={[
        { value: 'today', label: 'Today', icon: <Text>•</Text> },
        { value: 'plants', label: 'Plants', icon: <Text>•</Text> },
      ]}
    />
  );
  const bar = flat(hostByRole(tree, 'tablist'));
  expect(bar.backgroundColor).toBe(dark.background.primary);
  expect(bar.borderTopColor).toBe(dark.border.primary);
  expect(flat(textNode(tree, 'Today')).color).toBe(dark.text.primary);
  expect(flat(textNode(tree, 'Plants')).color).toBe(dark.text.secondary);
});

test('Snackbar inverts: a light bar with dark copy on the dark theme', () => {
  const tree = renderDark(<Snackbar label="Task completed" />);
  expect(flat(hostByRole(tree, 'alert')).backgroundColor).toBe(dark.background.primaryInverse);
  expect(flat(textNode(tree, 'Task completed')).color).toBe(dark.text.primaryInverse);
});

test('TextInput field, ink and keyboard follow the dark theme', () => {
  const tree = renderDark(<TextInput label="Plant Name" value="Monstera" />);
  const input = tree.root.findByType(RNTextInput);
  expect(flat(input.parent).backgroundColor).toBe(dark.background.primary);
  expect(flat(input.parent).borderColor).toBe(dark.border.primary);
  expect(flat(input).color).toBe(dark.text.primary);
  expect(input.props.placeholderTextColor).toBe(dark.text.placeholder);
  expect(input.props.keyboardAppearance).toBe('dark');
});
