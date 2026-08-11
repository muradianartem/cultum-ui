import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * TextButton — low-emphasis, chrome-less tappable text.
 *
 * Ported from the prototype's `.txt-btn`. No pill, no fill: just a weighted
 * label used inline in rows and at the foot of sheets ("Not now", "Undo",
 * "Skip"). Distinct from <Button>, which is the sized pill.
 *
 * tone:   default (green-deep) | danger (burnt orange — destructive text) | muted
 * size:   md (15) | sm (13.5)
 * inline: tighter padding for sitting beside other text.
 */

const TONES = {
  default: colors.greenDeep,
  danger: colors.danger,
  muted: colors.ink2,
};

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
  const color = TONES[tone] || TONES.default;
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
              styles.label,
              { color, fontSize: size === 'sm' ? 13.5 : 15 },
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
  label: { fontWeight: '600' },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.42 },
});
