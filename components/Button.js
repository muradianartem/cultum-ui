import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { button, radius } from '../theme/tokens';
import { usePressScale } from './usePressScale';

/**
 * Button — Cultum's primary action control, imported from Figma "Button – P1".
 *
 * Figma models it on four axes; this primitive maps them to props:
 *   Figma Type        → `variant`:     primary | secondary | outline | ghost
 *   Figma Destructive → `destructive`: boolean (red action colours)
 *   Figma Size        → `size`:        lg (56) | md (48) | sm (40)  — pill height
 *   Figma State       → derived:       `disabled`, `loading`, and the pressed
 *                                       colour swap via Pressable
 *
 * For low-emphasis, chrome-less inline actions ("Not now", "Undo") use
 * <TextButton>, a separate primitive.
 */

function palette(variant, destructive) {
  if (destructive) {
    return (
      { primary: button.dangerPrimary, secondary: button.dangerSecondary, outline: button.dangerOutline, ghost: button.dangerGhost }[variant] ||
      button.dangerPrimary
    );
  }
  return button[variant] || button.primary;
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
  const p = palette(variant, destructive);
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
            backgroundColor: isDisabled
              ? button.disabledBg
              : pressed && !p.stateLayer
              ? p.bgPressed
              : p.bg,
          },
          hasBorder && {
            borderWidth: 1,
            borderColor: isDisabled ? button.disabledBorder : p.border,
          },
          fullWidth && styles.blockInner,
        ]}
        {...rest}
      >
        {({ pressed }) => (
          <>
            {pressed && p.stateLayer && !isDisabled ? (
              <View pointerEvents="none" style={styles.stateLayer} />
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
                      { color: isDisabled ? button.disabledFg : p.fg, fontSize: sz.fontSize },
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
  // Figma outline/ghost State=Pressed: a translucent tint over the base fill.
  stateLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: button.pressedLayer,
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
