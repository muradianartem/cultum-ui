import TestRenderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';
import Badge from '../Badge';
import { Badge as BarrelBadge } from '../index';
import { badge } from '../../theme/tokens';

// --- tiny query helpers over the react-test-renderer tree ---
function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

// The single rendered label string.
function labelText(tree) {
  return tree.root.findByType(Text).props.children;
}

// Flattened style object of the outermost host View (the pill).
function pillStyle(tree) {
  const pill = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'text'
  );
  return Object.assign({}, ...[].concat(pill.props.style).filter(Boolean));
}

test('is exported from the components barrel', () => {
  expect(BarrelBadge).toBe(Badge);
});

test('renders its label text', () => {
  const tree = create(<Badge label="New" />);
  expect(labelText(tree)).toBe('New');
});

test('accepts children in place of label', () => {
  const tree = create(<Badge>Beta</Badge>);
  expect(labelText(tree)).toBe('Beta');
});

test('primary + neutral is the filled brand-green pill with dark ink', () => {
  const tree = create(<Badge label="9" intent="neutral" variant="primary" />);
  expect(pillStyle(tree).backgroundColor).toBe(badge.neutral.solid);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: badge.neutral.onSolid })])
  );
});

test('secondary uses the tinted soft fill and soft ink per intent', () => {
  const tree = create(<Badge label="Late" intent="negative" variant="secondary" />);
  expect(pillStyle(tree).backgroundColor).toBe(badge.negative.soft);
});

test('outline is transparent with a 1px border in the intent line colour', () => {
  const tree = create(<Badge label="Due" intent="positive" variant="outline" />);
  const s = pillStyle(tree);
  expect(s.backgroundColor).toBe('transparent');
  expect(s.borderWidth).toBe(1);
  expect(s.borderColor).toBe(badge.positive.line);
});

test('ghost has no fill and no border', () => {
  const tree = create(<Badge label="Info" variant="ghost" />);
  const s = pillStyle(tree);
  expect(s.backgroundColor).toBe('transparent');
  expect(s.borderWidth).toBeUndefined();
});

test('size maps to pill height (sm 16 / md 20 / lg 24)', () => {
  expect(pillStyle(create(<Badge label="a" size="sm" />)).height).toBe(16);
  expect(pillStyle(create(<Badge label="a" size="md" />)).height).toBe(20);
  expect(pillStyle(create(<Badge label="a" size="lg" />)).height).toBe(24);
});

test('icon-only renders no text and squares the pill', () => {
  const icon = <View testID="glyph" />;
  const tree = create(<Badge leftIcon={icon} size="md" />);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  const s = pillStyle(tree);
  expect(s.minWidth).toBe(20);
  expect(s.paddingHorizontal).toBe(0);
});

test('exposes the label to assistive tech', () => {
  const tree = create(<Badge label="Overdue" />);
  const pill = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'text'
  );
  expect(pill.props.accessibilityLabel).toBe('Overdue');
});

test('unknown intent falls back to neutral', () => {
  const tree = create(<Badge label="x" intent="bogus" variant="primary" />);
  expect(pillStyle(tree).backgroundColor).toBe(badge.neutral.solid);
});
