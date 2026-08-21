import TestRenderer, { act } from 'react-test-renderer';
import LoadingIndicator from '../LoadingIndicator';
import { LoadingIndicator as BarrelLoading } from '../index';
import { loading } from '../../theme/tokens';

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const ring = (tree) =>
  tree.root.find(
    (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'progressbar'
  );
const ringStyle = (tree) =>
  Object.assign({}, ...[].concat(ring(tree).props.style).filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelLoading).toBe(LoadingIndicator);
});

test('renders an accessible progressbar with the token stroke colour', () => {
  const tree = create(<LoadingIndicator />);
  expect(ring(tree).props.accessibilityLabel).toBe('Loading');
  const s = ringStyle(tree);
  expect(s.borderTopColor).toBe(loading.color);
  expect(s.width).toBe(loading.size);
});

test('size and color are overridable', () => {
  const s = ringStyle(create(<LoadingIndicator size={40} color="#123456" />));
  expect(s.width).toBe(40);
  expect(s.borderTopColor).toBe('#123456');
});
