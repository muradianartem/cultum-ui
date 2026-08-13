import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { toggle, radius, motion } from '../theme/tokens';

/**
 * Toggle — binary on/off switch, imported from Figma "Toggle – P1".
 *
 * Figma axes → state: Selected → `value`, State (Pressed) → the Pressable's
 * pressed feedback. The wide 34×22 thumb slides 3↔23 and shifts grey→green
 * between off and on; the track darkens while pressed.
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
  const thumbColor = value ? toggle.thumbOn : toggle.thumbOff;

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.track,
        { backgroundColor: pressed && !disabled ? toggle.trackPressed : toggle.track },
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: thumbColor, transform: [{ translateX }] },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: toggle.width,
    height: toggle.height,
    borderRadius: radius.pill,
    justifyContent: 'center',
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
