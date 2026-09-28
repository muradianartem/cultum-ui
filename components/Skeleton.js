import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { radius as radii } from '../theme/foundations';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Drive a skeleton pulse: 1 → 0.5 → 1 opacity, looped. Returns the value to
 * hand every <Skeleton pulse> on a screen, so the blocks breathe together
 * instead of each running (and drifting on) a loop of its own. Holds still at
 * full opacity when the system asks for reduced motion.
 */
export function useSkeletonPulse() {
  const pulse = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => alive && setReduceMotion(!!on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return undefined;
    }
    const half = (toValue) =>
      Animated.timing(pulse, {
        toValue,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const anim = Animated.loop(Animated.sequence([half(0.5), half(1)]));
    anim.start();
    return () => anim.stop();
  }, [pulse, reduceMotion]);

  return pulse;
}

/**
 * Skeleton — a placeholder block for content that is still loading, from Figma
 * "Today / Loading" (737:15483). A flat `disabled-skeleton` fill; `pulse` (from
 * useSkeletonPulse) animates its opacity. Hidden from assistive tech: the
 * screen around it says what is loading, once.
 */
export default function Skeleton({ width, height, radius = radii[8], pulse, style }) {
  const t = useTheme();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: t.disabled.skeleton },
        pulse ? { opacity: pulse } : null,
        style,
      ]}
    />
  );
}
