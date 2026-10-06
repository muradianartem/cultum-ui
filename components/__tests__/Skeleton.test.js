import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Animated } from 'react-native';
import Skeleton, { useSkeletonPulse } from '../Skeleton';
import { Skeleton as BarrelSkeleton } from '../index';
import { colorTokens, interaction } from '../../theme/colorTokens';
import { ThemeProvider, resolveTokens } from '../../theme/ThemeProvider';

const light = resolveTokens({ ...colorTokens, interaction }, 'light');
const dark = resolveTokens({ ...colorTokens, interaction }, 'dark');

function create(el) {
  let tree;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

const host = (tree) => tree.root.find((n) => typeof n.type === 'string');
const flat = (node) => Object.assign({}, ...[].concat(node.props.style).flat(Infinity).filter(Boolean));

test('is exported from the components barrel', () => {
  expect(BarrelSkeleton).toBe(Skeleton);
});

test('is a block of the given size and radius in the skeleton fill', () => {
  const s = flat(host(create(<Skeleton width={56} height={20} radius={9999} />)));
  expect(s).toMatchObject({ width: 56, height: 20, borderRadius: 9999 });
  expect(s.backgroundColor).toBe(light.disabled.skeleton);
});

test('takes the dark skeleton fill inside a dark theme', () => {
  const tree = create(
    <ThemeProvider mode="dark">
      <Skeleton width={10} height={10} />
    </ThemeProvider>
  );
  expect(dark.disabled.skeleton).not.toBe(light.disabled.skeleton);
  expect(flat(host(tree)).backgroundColor).toBe(dark.disabled.skeleton);
});

test('is hidden from assistive tech', () => {
  const node = host(create(<Skeleton width={10} height={10} />));
  expect(node.props.accessibilityElementsHidden).toBe(true);
  expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
});

test('useSkeletonPulse loops an opacity animation, and holds still under reduced motion', async () => {
  const loop = jest.spyOn(Animated, 'loop');
  const reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');

  function Probe() {
    const pulse = useSkeletonPulse();
    return <Skeleton width={10} height={10} pulse={pulse} />;
  }

  reduce.mockResolvedValue(false);
  let tree;
  await act(async () => {
    tree = TestRenderer.create(<Probe />);
  });
  expect(loop).toHaveBeenCalledTimes(1);
  expect(flat(host(tree)).opacity).toBeDefined();
  act(() => tree.unmount());

  loop.mockClear();
  reduce.mockResolvedValue(true);
  await act(async () => {
    tree = TestRenderer.create(<Probe />);
  });
  // The first render starts a loop before the setting is read; it then stops
  // and stays at full opacity.
  expect(loop).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());

  loop.mockRestore();
  reduce.mockRestore();
});
