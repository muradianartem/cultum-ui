import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { button, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { usePressScale } from './usePressScale';

/**
 * ButtonIcon — circular icon-only button, imported from Figma "Button Icon – P1".
 *
 * The icon-only sibling of <Button>: identical Type/Destructive/State axes and
 * colours (the same semantic roles, resolved from useTheme()), but square and one
 * step smaller (lg 48 / md 40 / sm 32). Icon-agnostic — pass the glyph as
 * `icon`/`children`.
 *
 * `accessibilityLabel` is required — there is no text to name the control.
 */
// Mirrors Button's palette so the two stay visually identical per variant.
function palette(t, variant, destructive) {
  if (destructive) {
    return {
      primary: { bg: t.error.primary, fg: t.error.onPrimary },
      secondary: { bg: t.error.secondary, fg: t.error.onSecondary },
      outline: { bg: 'transparent', fg: t.error.primary, border: t.error.primary },
      ghost: { bg: 'transparent', fg: t.error.primary },
    }[variant] || { bg: t.error.primary, fg: t.error.onPrimary };
  }
  return {
    primary: { bg: t.brand.primary, fg: t.brand.onPrimary },
    secondary: { bg: t.brand.secondary, fg: t.brand.onSecondary },
    outline: { bg: t.background.primary, fg: t.text.primary, border: t.border.primary },
    ghost: { bg: 'transparent', fg: t.text.primary },
  }[variant] || { bg: t.brand.primary, fg: t.brand.onPrimary };
}

export default function ButtonIcon({
  icon,
  children,
  onPress,
  variant = 'primary',
  destructive = false,
  size = 'md',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  ...rest
}) {
  const t = useTheme();
  const p = palette(t, variant, destructive);
  const dim = button.iconSizes[size] || button.iconSizes.md;
  const isDisabled = disabled || loading;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const hasBorder = p.border != null;
  const glyph = children ?? icon;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.base,
          {
            width: dim,
            height: dim,
            backgroundColor: isDisabled ? t.disabled.surface : p.bg,
          },
          hasBorder && {
            borderWidth: 1,
            borderColor: isDisabled ? t.disabled.border : p.border,
          },
        ]}
        {...rest}
      >
        {({ pressed }) => (
          <>
            {pressed && !isDisabled ? (
              <View
                pointerEvents="none"
                style={[styles.stateLayer, { backgroundColor: t.interaction.pressed }]}
              />
            ) : null}
            {loading ? (
              <ActivityIndicator color={p.fg} size="small" />
            ) : (
              <View style={styles.icon}>{glyph}</View>
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clip the pressed state layer to the circle
  },
  // Pressed State layer: a translucent tint over the base fill (colour from
  // t.interaction.pressed at render so it follows the theme), as on <Button>.
  stateLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
