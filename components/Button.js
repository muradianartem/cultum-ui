import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { button, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { usePressScale } from './usePressScale';

/**
 * Button — Cultum's primary action control, imported from Figma "Button – P1".
 *
 * Figma models it on four axes; this primitive maps them to props:
 *   Figma Type        → `variant`:     primary | secondary | outline | ghost
 *   Figma Destructive → `destructive`: boolean (red action colours)
 *   Figma Size        → `size`:        lg (56) | md (48) | sm (40)  — pill height
 *   Figma State       → derived:       `disabled`, `loading`, and the pressed
 *                                       state layer via Pressable
 *
 * Colours come from the semantic token layer via useTheme() (so the button
 * follows light/dark), mapped per variant to the roles authored in Figma's
 * Color Tokens page. Geometry (pill height, padding, radius) stays in the
 * mode-independent token exports. `button.sizes` below is geometry only.
 *
 * For low-emphasis, chrome-less inline actions ("Not now", "Undo") use
 * <TextButton>, a separate primitive.
 */

// Resolve the variant's { bg, fg, border? } from the active theme (`t`).
// Pressed is a universal translucent state layer (t.interaction.pressed)
// laid over the fill, rather than a per-variant fill swap.
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
    // Primary CTA = brand-primary, which the Figma token page now resolves to the
    // brand green (primary-500) in light / primary-400 in dark.
    primary: { bg: t.brand.primary, fg: t.brand.onPrimary },
    secondary: { bg: t.brand.secondary, fg: t.brand.onSecondary },
    // Figma's outline button is opaque, not see-through (theme/tokens.js
    // button.outline.bg === '#FAFAFA' in light, '#151515' in dark) — both are
    // background.primary. It has to be opaque so outline buttons laid over
    // photography (the auth Welcome screen) read as solid pills.
    outline: { bg: t.background.primary, fg: t.text.primary, border: t.border.primary },
    ghost: { bg: 'transparent', fg: t.text.primary },
  }[variant] || { bg: t.brand.primary, fg: t.brand.onPrimary };
}

export default function Button({
  label,
  children,
  onPress,
  variant = 'primary',
  destructive = false,
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
  const t = useTheme();
  const p = palette(t, variant, destructive);
  const sz = button.sizes[size] || button.sizes.md;
  const isDisabled = disabled || loading;
  const { scale, onPressIn, onPressOut } = usePressScale();

  const content = children ?? label;
  const hasBorder = p.border != null;

  return (
    <Animated.View
      style={[
        fullWidth ? styles.block : styles.inline,
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
        style={({ pressed }) => [
          styles.base,
          {
            height: sz.height,
            paddingHorizontal: sz.paddingHorizontal,
            backgroundColor: isDisabled ? t.disabled.surface : p.bg,
          },
          hasBorder && {
            borderWidth: 1,
            borderColor: isDisabled ? t.disabled.border : p.border,
          },
          fullWidth && styles.blockInner,
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
              <View style={styles.row}>
                {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
                {typeof content === 'string' ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      { color: isDisabled ? t.disabled.on : p.fg, fontSize: sz.fontSize },
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
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%' },
  blockInner: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clip the pressed state layer to the pill
  },
  // Pressed State layer: a translucent tint over the base fill (colour comes
  // from t.interaction.pressed at render so it follows the theme).
  stateLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontWeight: '500', // Figma "Button/Button Medium" — Inter Medium
    letterSpacing: 0.1,
  },
});
