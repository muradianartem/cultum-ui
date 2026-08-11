import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, controls, shadow } from '../theme/tokens';
import { usePressScale } from './usePressScale';

/**
 * Button — Cultum's primary action primitive: a pill, 52px tall, weight 600.
 *
 * Ported from the prototype's `.btn` family. Green is reserved for care verbs
 * and health-positive actions (design rule), so `primary` is the green fill;
 * use `dark` / `secondary` / `outline` / `ghost` for everything else, and the
 * filled `danger` for destructive confirmations.
 *
 * For low-emphasis, inline, chrome-less actions ("Not now", "Undo"), use
 * <TextButton> instead — that is a different primitive, not a Button variant.
 *
 * Variants: primary | dark | secondary | outline | ghost | danger
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
  const { scale, onPressIn, onPressOut } = usePressScale();

  const height = size === 'sm' ? controls.btnHeightSm : controls.btnHeight;
  const labelSize = size === 'sm' ? 15 : 16;
  const content = children ?? label;

  return (
    <Animated.View
      style={[
        fullWidth ? styles.block : styles.inline,
        v.shadow && !isDisabled ? v.shadow : null,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={
          accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
        }
        style={[
          styles.base,
          { height, backgroundColor: v.bg },
          v.border,
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
                style={[styles.label, { color: v.fg, fontSize: labelSize }, textStyle]}
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
