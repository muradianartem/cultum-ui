import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { loading } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * LoadingIndicator — spinner, imported from Figma "Loading Indicator – P2".
 *
 * Figma ships four rotation frames of a 24px ring (2px stroke, text-placeholder
 * over a surface-primary track); here it spins continuously. Drawn as a bordered
 * circle with one accented edge.
 *
 * `size` and `color` are overridable; the colour defaults to the active theme.
 */
export default function LoadingIndicator({
  size = loading.size,
  color,
  style,
  accessibilityLabel = 'Loading',
  ...rest
}) {
  const t = useTheme();
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
          borderColor: t.surface.primary,
          borderTopColor: color ?? t.text.placeholder,
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
