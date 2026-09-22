import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Divider from '../Divider';
import { Divider as BarrelDivider } from '../index';
import { divider } from '../../theme/tokens';
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

// Flattened style of the single host View (non-label dividers).
function lineStyle(tree) {
  const v = tree.root.find((n) => typeof n.type === 'string' && n.type === 'View');
  return Object.assign({}, ...[].concat(v.props.style).filter(Boolean));
}

test('is exported from the components barrel', () => {
  expect(BarrelDivider).toBe(Divider);
});

test('small is a 1px hairline', () => {
  const s = lineStyle(create(<Divider size="sm" />));
  expect(s.height).toBe(1);
  expect(s.backgroundColor).toBe(t.border.primary);
});

test('large is an 8px block separator', () => {
  const s = lineStyle(create(<Divider size="lg" />));
  expect(s.height).toBe(divider.blockHeight);
  expect(s.backgroundColor).toBe(t.surface.primary);
});

test('margin adds a 16px horizontal inset', () => {
  expect(lineStyle(create(<Divider margin />)).marginHorizontal).toBe(16);
  expect(lineStyle(create(<Divider />)).marginHorizontal).toBeUndefined();
});

test('label renders a centred caption between two hairlines', () => {
  const tree = create(<Divider label="OR" />);
  expect(tree.root.findByType(Text).props.children).toBe('OR');
  const hairlines = tree.root
    .findAll((n) => typeof n.type === 'string' && n.type === 'View')
    .filter((v) => {
      const s = Object.assign({}, ...[].concat(v.props.style).filter(Boolean));
      return s.backgroundColor === t.border.primary;
    });
  expect(hairlines.length).toBe(2);
});
