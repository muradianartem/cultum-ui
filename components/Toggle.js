import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { toggle, radius, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Toggle — binary on/off switch, imported from Figma "Toggle" (node 27383:1945).
 *
 * Figma axes → state: Selected → `value`, State (Pressed) → the Pressable's
 * pressed feedback. The wide 34×22 thumb slides 3↔23; the *track* carries the
 * brand green when on, with a near-white thumb over it, and both tracks darken
 * under a translucent state layer while pressed (the thumb does not).
 *
 * Colours come from the semantic token layer via useTheme() (so the toggle
 * follows light/dark); `toggle` below is geometry only.
 *
 * Controlled: pass `value` + `onValueChange`.
 */
export default function Toggle({
  value = false,
  onValueChange,
  disabled = false,
  style,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: motion.durFast,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [toggle.pad, toggle.width - toggle.thumbW - toggle.pad],
  });

  // Discrete colour swaps straight off the prop — never interpolated (see
  // docs/figma-import.md); only `transform` is native-driven.
  const trackColor = value ? t.brand.primary : t.surface.secondary;
  const thumbColor = value ? t.background.primary : t.border.primary;

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: trackColor }, disabled && styles.disabled, style]}
      {...rest}
    >
      {({ pressed }) => (
        <>
          {/* Under the thumb: Figma darkens the track only, not the thumb. */}
          {pressed && !disabled ? (
            <View
              pointerEvents="none"
              style={[styles.stateLayer, { backgroundColor: t.interaction.pressed }]}
            />
          ) : null}
          <Animated.View
            style={[
              styles.thumb,
              { backgroundColor: thumbColor, transform: [{ translateX }] },
            ]}
          />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: toggle.width,
    height: toggle.height,
    borderRadius: radius.pill,
    justifyContent: 'center',
    overflow: 'hidden', // clip the pressed state layer to the pill
  },
  // Pressed state layer: a translucent tint over the track fill (colour comes
  // from t.interaction.pressed at render so it follows the theme).
  stateLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  thumb: {
    position: 'absolute',
    top: toggle.pad,
    width: toggle.thumbW,
    height: toggle.thumbH,
    borderRadius: radius.pill,
  },
  disabled: { opacity: 0.42 },
});
