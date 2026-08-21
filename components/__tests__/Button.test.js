import TestRenderer, { act } from 'react-test-renderer';
import { Text, ActivityIndicator } from 'react-native';
import Button from '../Button';
import { Button as BarrelButton } from '../index';
import { button } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

// The host node the press handler + a11y live on.
function btn(tree) {
  return tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button'
  );
}

// Its resolved style, flattened to one object.
function btnStyle(tree) {
  return Object.assign({}, ...[].concat(btn(tree).props.style).filter(Boolean));
}

test('is exported from the components barrel', () => {
  expect(BarrelButton).toBe(Button);
});

test('primary enabled is the brand-green pill with dark ink', () => {
  const tree = create(<Button label="Go" />);
  expect(btnStyle(tree).backgroundColor).toBe(button.primary.bg);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: button.primary.fg })])
  );
});

test('destructive primary uses the red action colour', () => {
  const tree = create(<Button label="Delete" destructive />);
  expect(btnStyle(tree).backgroundColor).toBe(button.dangerPrimary.bg);
});

test('outline draws a 1px border in the variant border colour', () => {
  const tree = create(<Button label="More" variant="outline" />);
  const s = btnStyle(tree);
  expect(s.borderWidth).toBe(1);
  expect(s.borderColor).toBe(button.outline.border);
});

test('pressed state follows Figma: filled types swap fill, outline/ghost use a state layer', () => {
  // Figma State=Pressed models two ways: filled variants have a distinct
  // bgPressed fill; outline/ghost keep their base fill + a translucent overlay.
  expect(button.pressedLayer).toBe('rgba(0,0,0,0.08)');
  for (const v of ['primary', 'secondary', 'dangerPrimary', 'dangerSecondary']) {
    expect(button[v].bgPressed).toBeDefined();
    expect(button[v].stateLayer).toBeUndefined();
  }
  for (const v of ['outline', 'ghost', 'dangerOutline', 'dangerGhost']) {
    expect(button[v].stateLayer).toBe(true);
    expect(button[v].bgPressed).toBeUndefined();
  }
});

test('size maps to Figma pill height (lg 56 / md 48 / sm 40)', () => {
  expect(btnStyle(create(<Button label="a" size="lg" />)).height).toBe(56);
  expect(btnStyle(create(<Button label="a" size="md" />)).height).toBe(48);
  expect(btnStyle(create(<Button label="a" size="sm" />)).height).toBe(40);
});

test('disabled uses the disabled fill + ink and blocks interaction', () => {
  const tree = create(<Button label="x" disabled />);
  expect(btnStyle(tree).backgroundColor).toBe(button.disabledBg);
  expect(btn(tree).props.accessibilityState.disabled).toBe(true);
  expect(tree.root.findByType(Text).props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: button.disabledFg })])
  );
});

test('loading shows a spinner instead of the label and marks busy', () => {
  const tree = create(<Button label="Saving" loading />);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
  expect(btn(tree).props.accessibilityState.busy).toBe(true);
});
