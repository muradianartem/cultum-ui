import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/foundations';

/**
 * TextButton — low-emphasis, chrome-less tappable text.
 *
 * Ported from the prototype's `.txt-btn`. No pill, no fill: just a weighted
 * label used inline in rows and at the foot of sheets ("Not now", "Undo",
 * "Skip"). Distinct from <Button>, which is the sized pill.
 *
 * tone:   default (success green) | danger (error — destructive text) | muted
 * size:   md (15) | sm (13.5)
 * inline: tighter padding for sitting beside other text.
 */

// The prototype's green-deep / burnt-orange / ink-2 have no Figma counterpart;
// these are the nearest semantic roles, which also carry a dark value.
const tones = (t) => ({
  default: t.success.primary,
  danger: t.error.primary,
  muted: t.text.secondary,
});

export default function TextButton({
  label,
  children,
  onPress,
  tone = 'default',
  size = 'md',
  inline = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const palette = tones(t);
  const color = palette[tone] || palette.default;
  const content = children ?? label;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={
        accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
      }
      style={({ pressed }) => [
        styles.base,
        inline ? styles.inline : size === 'sm' ? styles.padSm : styles.pad,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        {typeof content === 'string' ? (
          <Text
            style={[
              // The design system has no text-button component; its labels
              // are the Ghost Button's (Button Medium / Button Small).
              typography[size === 'sm' ? 'buttonSmall' : 'buttonMedium'],
              { color },
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
  pad: { padding: 10 },
  padSm: { paddingVertical: 6, paddingHorizontal: 8 },
  inline: { paddingLeft: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.42 },
});
