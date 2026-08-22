import { useRef } from 'react';
import { Animated } from 'react-native';

// Shared press feedback for tappable primitives — a small spring scale-down,
// matching the prototype's `transform: scale(.97)` on :active.
export function usePressScale(to = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (value) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  return {
    scale,
    onPressIn: () => spring(to),
    onPressOut: () => spring(1),
  };
}
