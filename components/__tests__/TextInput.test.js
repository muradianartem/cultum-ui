import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput as RNTextInput } from 'react-native';
import TextInput from '../TextInput';
import { TextInput as BarrelTextInput } from '../index';
import { colorTokens, interaction } from '../../theme/colorTokens';
import { resolveTokens } from '../../theme/ThemeProvider';

// The light theme as components resolve it outside a provider.
const t = resolveTokens({ ...colorTokens, interaction }, 'light');

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const input = (tree) => tree.root.findByType(RNTextInput);
const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
const field = (tree) => {
  const rn = input(tree);
  // the field wrapper is the RNTextInput's parent host View
  return rn.parent;
};
const fieldStyle = (tree) =>
  Object.assign({}, ...[].concat(field(tree).props.style).filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelTextInput).toBe(TextInput);
});

test('renders label, optional tag and helper', () => {
  const tree = create(
    <TextInput label="Email" optional helper="We never share it." value="" onChangeText={() => {}} />
  );
  const t = texts(tree);
  expect(t).toContain('Email');
  expect(t).toContain('Optional');
  expect(t).toContain('We never share it.');
});

test('forwards typing', () => {
  const onChangeText = jest.fn();
  const tree = create(<TextInput value="" onChangeText={onChangeText} />);
  act(() => input(tree).props.onChangeText('hi'));
  expect(onChangeText).toHaveBeenCalledWith('hi');
});

test('focus switches the border to ink', () => {
  const tree = create(<TextInput value="" onChangeText={() => {}} />);
  act(() => input(tree).props.onFocus());
  expect(fieldStyle(tree).borderColor).toBe(t.text.primary);
});

test('error string replaces helper, turns it red and reds the border', () => {
  const tree = create(<TextInput value="" onChangeText={() => {}} helper="hint" error="Required" />);
  const copy = texts(tree);
  expect(copy).toContain('Required');
  expect(copy).not.toContain('hint');
  expect(fieldStyle(tree).borderColor).toBe(t.error.primary);
});

test('disabled greys the fill and is not editable', () => {
  const tree = create(<TextInput value="x" onChangeText={() => {}} disabled />);
  expect(input(tree).props.editable).toBe(false);
  expect(fieldStyle(tree).backgroundColor).toBe(t.disabled.surface);
});
