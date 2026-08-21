import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import Dropdown from '../Dropdown';
import DropdownMenu, { MenuItem } from '../DropdownMenu';
import {
  Dropdown as BarrelDropdown,
  DropdownMenu as BarrelMenu,
  MenuItem as BarrelMenuItem,
} from '../index';
import { textInput, menu } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);
const trigger = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button'
  );
const triggerStyle = (tree) =>
  Object.assign({}, ...[].concat(trigger(tree).props.style).filter(Boolean));
const pressDeepest = (tree, role) => {
  const nodes = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityRole === role
  );
  nodes[nodes.length - 1].props.onPress();
};

test('Dropdown, DropdownMenu and MenuItem are exported', () => {
  expect(BarrelDropdown).toBe(Dropdown);
  expect(BarrelMenu).toBe(DropdownMenu);
  expect(BarrelMenuItem).toBe(MenuItem);
});

test('Dropdown shows placeholder, then the selected value', () => {
  expect(texts(create(<Dropdown placeholder="Pick one" />))).toContain('Pick one');
  expect(texts(create(<Dropdown value="Weekly" />))).toContain('Weekly');
});

test('open adds the focus border; error reds it and shows the message', () => {
  expect(triggerStyle(create(<Dropdown open />)).borderColor).toBe(textInput.borderFocus);
  const err = create(<Dropdown error="Required" helper="hint" />);
  expect(triggerStyle(err).borderColor).toBe(textInput.borderError);
  expect(texts(err)).toContain('Required');
  expect(texts(err)).not.toContain('hint');
});

test('tapping the trigger opens (fires onPress); disabled blocks it', () => {
  const onPress = jest.fn();
  const tree = create(<Dropdown label="Plan" onPress={onPress} />);
  act(() => pressDeepest(tree, 'button'));
  expect(onPress).toHaveBeenCalled();

  const dis = create(<Dropdown label="Plan" onPress={onPress} disabled />);
  act(() => pressDeepest(dis, 'button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('DropdownMenu renders items and fires their onPress', () => {
  const onPress = jest.fn();
  const tree = create(
    <DropdownMenu
      items={[
        { title: 'Rename', onPress },
        { title: 'Delete', subtitle: 'Permanent' },
      ]}
    />
  );
  expect(texts(tree)).toContain('Rename');
  expect(texts(tree)).toContain('Delete');
  expect(texts(tree)).toContain('Permanent');
  const rename = tree.root.find(
    (n) => n.props.accessibilityLabel === 'Rename' && typeof n.props.onPress === 'function'
  );
  act(() => rename.props.onPress());
  expect(onPress).toHaveBeenCalled();
});

test('DropdownMenu surface uses the token background', () => {
  const tree = create(<DropdownMenu items={[{ title: 'x' }]} />);
  const surface = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'menu'
  );
  const s = Object.assign({}, ...[].concat(surface.props.style).filter(Boolean));
  expect(s.backgroundColor).toBe(menu.bg);
});
