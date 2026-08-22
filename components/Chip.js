import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chip, radius } from '../theme/tokens';

/**
 * Chip — compact, selectable pill, imported from Figma "Chip – P1".
 *
 * Figma axes → props:
 *   State     → `selected` (Figma "Active"), `disabled`, + pressed feedback
 *   Show icon → `leftIcon` (a 24px leading node; icon-agnostic like <Button>)
 *
 * Selected and pressed both darken the fill; selected also darkens the ink.
 * Used in groups for filters / multi-select tags.
 */
export default function Chip({
  label,
  children,
  leftIcon,
  selected = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}) {
  const content = children ?? label;

  const ink = disabled ? chip.inkDisabled : selected ? chip.inkSelected : chip.ink;

  return (
    <Pressable
      onPress={() => !disabled && onPress?.()}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={
        accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
      }
      style={({ pressed }) => [
        styles.base,
        leftIcon ? styles.padIcon : styles.padText,
        {
          backgroundColor: disabled
            ? chip.bgDisabled
            : selected || pressed
            ? chip.bgSelected
            : chip.bg,
        },
        style,
      ]}
      {...rest}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      {typeof content === 'string' ? (
        <Text numberOfLines={1} style={[styles.label, { color: ink }, textStyle]}>
          {content}
        </Text>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: chip.height,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  padIcon: { paddingLeft: 4, paddingRight: 8 },
  padText: { paddingHorizontal: 12 },
  icon: {
    width: chip.iconSize,
    height: chip.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '400' },
});
