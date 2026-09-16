import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textInput } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Dropdown — single-select field, imported from Figma "Dropdown – P2".
 *
 * A labelled, non-editable field showing the selected value (or placeholder) and
 * a chevron; tapping it opens a menu (pair with <DropdownMenu>). Figma axes → props:
 *   Label / Optional / Helper → `label` / `optional` / `helper`
 *   Leading Area (Icon)       → `leftIcon`
 *   State (Focused/Error/Disabled) → `open` (focus border), `error`, `disabled`
 *
 * Same field visuals as <TextInput> (geometry from the `textInput` token group,
 * colours from the same semantic roles). `error` may be a string (shown in place
 * of helper, in red) or a boolean.
 */
export default function Dropdown({
  label,
  optional = false,
  helper,
  error,
  value,
  placeholder = 'Select',
  leftIcon,
  open = false,
  disabled = false,
  onPress,
  style,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const hasError = !!error;
  const helperText = typeof error === 'string' ? error : helper;
  const borderColor = hasError
    ? t.error.primary
    : open && !disabled
    ? t.text.primary
    : t.border.primary;
  const ink = { color: t.text.primary };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, ink]}>{label}</Text>
          {optional ? (
            <Text style={[styles.optional, { color: t.text.secondary }]}>Optional</Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => !disabled && onPress?.()}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        style={[
          styles.field,
          {
            borderColor,
            borderWidth: open && !disabled && !hasError ? 1.5 : 1,
            backgroundColor: disabled ? t.disabled.surface : t.background.primary,
          },
        ]}
        {...rest}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <Text numberOfLines={1} style={[styles.value, ink]}>
          {value || placeholder}
        </Text>
        <Text style={[styles.chevron, ink]}>▾</Text>
      </Pressable>

      {helperText ? (
        <Text style={[styles.helper, { color: hasError ? t.error.primary : t.text.secondary }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignSelf: 'stretch' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  optional: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: textInput.height,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: textInput.radius,
  },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  value: { flex: 1, fontSize: 14 },
  chevron: { fontSize: 14 },
  helper: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
});
