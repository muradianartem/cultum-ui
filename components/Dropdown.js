import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textInput } from '../theme/tokens';

/**
 * Dropdown — single-select field, imported from Figma "Dropdown – P2".
 *
 * A labelled, non-editable field showing the selected value (or placeholder) and
 * a chevron; tapping it opens a menu (pair with <DropdownMenu>). Figma axes → props:
 *   Label / Optional / Helper → `label` / `optional` / `helper`
 *   Leading Area (Icon)       → `leftIcon`
 *   State (Focused/Error/Disabled) → `open` (focus border), `error`, `disabled`
 *
 * Reuses the `textInput` token group (same field visuals). `error` may be a
 * string (shown in place of helper, in red) or a boolean.
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
  const hasError = !!error;
  const helperText = typeof error === 'string' ? error : helper;
  const borderColor = hasError
    ? textInput.borderError
    : open && !disabled
    ? textInput.borderFocus
    : textInput.border;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {optional ? <Text style={styles.optional}>Optional</Text> : null}
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
            backgroundColor: disabled ? textInput.bgDisabled : textInput.bg,
          },
        ]}
        {...rest}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <Text
          numberOfLines={1}
          style={[styles.value, !value && styles.placeholder]}
        >
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {helperText ? (
        <Text style={[styles.helper, hasError && styles.helperError]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignSelf: 'stretch' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 17, color: textInput.labelInk },
  optional: { fontSize: 12, fontWeight: '500', lineHeight: 17, color: textInput.optionalInk },
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
  value: { flex: 1, fontSize: 14, color: textInput.ink },
  placeholder: { color: textInput.ink },
  chevron: { fontSize: 14, color: textInput.ink },
  helper: { fontSize: 12, fontWeight: '500', lineHeight: 17, color: textInput.helperInk },
  helperError: { color: textInput.errorInk },
});
