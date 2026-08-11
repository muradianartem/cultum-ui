import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, controls, shadow, fontSize } from '../theme/tokens';

/**
 * Button — Cultum's primary action primitive.
 *
 * Ported from the prototype's `.btn` family. A pill, 52px tall, weight 600.
 * Green is reserved for care verbs and health-positive actions (design rule),
 * so `primary` is the green fill; use `dark` / `secondary` / `outline` for
 * everything else and `danger` (burnt orange, never red) for destructive text.
 *
 * Variants: primary | dark | secondary | outline | ghost | danger | text
 * Sizes:    md (52) | sm (44)
 */

const VARIANTS = {
  primary: { bg: colors.green, fg: colors.greenInk, shadow: shadow.green },
  dark: { bg: colors.invertBg, fg: colors.invertInk },
  secondary: { bg: colors.surface2, fg: colors.ink },
  outline: {
    bg: colors.surface,
    fg: colors.ink,
    border: { borderWidth: 1.5, borderColor: colors.hairline },
  },
  ghost: {
    bg: colors.onbSurface,
    fg: colors.onbInk,
    border: { borderWidth: 1.5, borderColor: colors.onbLine },
  },
  danger: { bg: colors.danger, fg: colors.white },
  // text button: no fill, low emphasis, green-deep label
  text: { bg: 'transparent', fg: colors.greenDeep, text: true },
};

export default function Button({
  label,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  // The `text` variant is a bare label with no pill chrome.
  const isText = v.text;
  const height = size === 'sm' ? controls.btnHeightSm : controls.btnHeight;
  const labelSize = isText ? fontSize.body : size === 'sm' ? 15 : 16;

  const content = children ?? label;

  return (
    <Animated.View
      style={[
        fullWidth && !isText ? styles.block : styles.inline,
        !isText && v.shadow && !isDisabled ? v.shadow : null,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={
          accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
        }
        style={[
          isText ? styles.textBtn : styles.base,
          !isText && { height, backgroundColor: v.bg },
          !isText && v.border,
          isDisabled && styles.disabled,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} size="small" />
        ) : (
          <View style={styles.row}>
            {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
            {typeof content === 'string' ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: v.fg, fontSize: labelSize },
                  textStyle,
                ]}
              >
                {content}
              </Text>
            ) : (
              content
            )}
            {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%' },
  inline: { alignSelf: 'flex-start' },
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  textBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  disabled: { opacity: 0.42 },
});
