import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import SearchBar from '../SearchBar';
import { SearchBar as BarrelSearch } from '../index';
import { searchBar } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const input = (tree) => tree.root.findByType(TextInput);
const byLabel = (tree, label) =>
  tree.root.find(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function'
  );

test('is exported from the components barrel', () => {
  expect(BarrelSearch).toBe(SearchBar);
});

test('shows the placeholder and forwards typing', () => {
  const onChangeText = jest.fn();
  const tree = create(<SearchBar value="" onChangeText={onChangeText} placeholder="Find plants" />);
  expect(input(tree).props.placeholder).toBe('Find plants');
  act(() => input(tree).props.onChangeText('fern'));
  expect(onChangeText).toHaveBeenCalledWith('fern');
});

test('clear button appears only when filled and clears the value', () => {
  const onChangeText = jest.fn();
  const empty = create(<SearchBar value="" onChangeText={onChangeText} />);
  expect(() => byLabel(empty, 'Clear search')).toThrow();

  const filled = create(<SearchBar value="rose" onChangeText={onChangeText} />);
  act(() => byLabel(filled, 'Clear search').props.onPress());
  expect(onChangeText).toHaveBeenCalledWith('');
});

test('focus adds the ink border', () => {
  const tree = create(<SearchBar value="" onChangeText={() => {}} />);
  act(() => input(tree).props.onFocus());
  const field = tree.root.findAll(
    (n) => typeof n.type === 'string' && n.type === 'View'
  )[0];
  const s = Object.assign({}, ...[].concat(field.props.style).filter(Boolean));
  expect(s.borderColor).toBe(searchBar.focusBorder);
});

test('disabled is not editable', () => {
  const tree = create(<SearchBar value="x" onChangeText={() => {}} disabled />);
  expect(input(tree).props.editable).toBe(false);
});
