import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { textInput } from '../theme/tokens';
import { useTheme, useThemeMode } from '../theme/ThemeProvider';

/**
 * TextInput — labelled form field, imported from Figma "Text Input – P2".
 *
 * A caption label (with an optional "Optional" tag) over a 48px bordered field,
 * over a helper line. Figma axes → props:
 *   Show label / Optional / Helper → `label`, `optional`, `helper`
 *   State (Focused/Error/Disabled) → focus is internal; `error` and `disabled`
 *   Leading/Trailing Area          → `leftIcon` / `rightIcon`
 *
 * `error` may be a boolean or a string; a string replaces the helper text and
 * turns it red. Controlled via `value` + `onChangeText`. The keyboard follows
 * the active theme.
 */
export default function TextInput({
  label,
  optional = false,
  helper,
  error,
  value,
  onChangeText,
  placeholder,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  inputStyle,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const { effective } = useThemeMode();
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const helperText = typeof error === 'string' ? error : helper;

  const borderColor = hasError
    ? t.error.primary
    : focused && !disabled
    ? t.text.primary
    : t.border.primary;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: t.text.primary }]}>{label}</Text>
          {optional ? (
            <Text style={[styles.optional, { color: t.text.secondary }]}>Optional</Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderColor,
            borderWidth: focused && !disabled && !hasError ? 1.5 : 1,
            backgroundColor: disabled ? t.disabled.surface : t.background.primary,
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.text.placeholder}
          keyboardAppearance={effective}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label}
          style={[styles.input, { color: t.text.primary }, inputStyle]}
          {...rest}
        />
        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>

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
  label: { fontSize: 12, lineHeight: 17 },
  optional: { fontSize: 12, lineHeight: 17 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: textInput.height,
    paddingHorizontal: 16,
    borderRadius: textInput.radius,
  },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 14, padding: 0 },
  helper: { fontSize: 12, lineHeight: 17 },
});
