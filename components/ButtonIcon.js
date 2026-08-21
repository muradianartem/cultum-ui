import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { button, radius } from '../theme/tokens';
import { usePressScale } from './usePressScale';

/**
 * ButtonIcon — circular icon-only button, imported from Figma "Button Icon – P1".
 *
 * The icon-only sibling of <Button>: identical Type/Destructive/State axes and
 * colours (it reuses the `button` token group), but square and one step smaller
 * (lg 48 / md 40 / sm 32). Icon-agnostic — pass the glyph as `icon`/`children`.
 *
 * `accessibilityLabel` is required — there is no text to name the control.
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
  const p = palette(variant, destructive);
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
        style={({ pressed }) => [
          styles.base,
          {
            width: dim,
            height: dim,
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
  // Figma outline/ghost State=Pressed: a translucent tint over the base fill.
  stateLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: button.pressedLayer,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
