import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Circle } from 'react-native-svg';
import ConfidenceRing from '../ConfidenceRing';
import { ConfidenceRing as BarrelRing } from '../index';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const texts = (tree) => tree.root.findAllByType(Text).map((n) => n.props.children);

test('is exported from the components barrel', () => {
  expect(BarrelRing).toBe(ConfidenceRing);
});

test('renders the percent as centered text', () => {
  const tree = create(<ConfidenceRing percent={52} />);
  expect(texts(tree)).toContain('52%');
});

// The arc Circle is the one carrying a strokeDasharray; the track has none.
const arcDash = (tree) =>
  tree.root
    .findAllByType(Circle)
    .map((n) => n.props.strokeDasharray)
    .find((d) => Array.isArray(d));

test('arc dash length is percent-of-circumference of the full track', () => {
  const dash = arcDash(create(<ConfidenceRing percent={25} />));
  const [arc, circumference] = dash;
  expect(arc / circumference).toBeCloseTo(0.25, 5);
});

test('a full ring draws the whole circumference', () => {
  const [arc, circumference] = arcDash(create(<ConfidenceRing percent={100} />));
  expect(arc).toBeCloseTo(circumference, 5);
});
