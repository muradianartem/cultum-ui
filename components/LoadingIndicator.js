import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { loading } from '../theme/tokens';

/**
 * LoadingIndicator — spinner, imported from Figma "Loading Indicator – P2".
 *
 * Figma ships four rotation frames of a 24px ring (2px stroke #606160); here it
 * spins continuously. Drawn as a bordered circle with one accented edge (no
 * react-native-svg in the project).
 *
 * `size` and `color` are overridable; defaults come from the token.
 */
export default function LoadingIndicator({
  size = loading.size,
  color = loading.color,
  style,
  accessibilityLabel = 'Loading',
  ...rest
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: loading.stroke,
          borderColor: loading.track,
          borderTopColor: color,
          transform: [{ rotate }],
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  ring: {},
});
