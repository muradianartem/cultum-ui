import { useState } from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { useTheme, useThemeMode } from '../theme/ThemeProvider';
import { typography } from '../theme/foundations';

/**
 * TextArea — multi-line input, imported from Figma "Text Area" (node 486:27425).
 *
 * Figma's own description: "Multi-line input for longer free-form text. Mirrors
 * Text Input for label, helper and error behaviour, and adds a character
 * counter. Resize the box vertically to fit the expected answer length; 132 is
 * the default."
 *
 * So it deliberately repeats <TextInput>'s prop surface rather than wrapping it:
 * the box is a different shape (fixed height, top-aligned text, 12px radius
 * against the field's 8) and multiline RNTextInput needs `textAlignVertical`
 * and its own padding, none of which the single-line field wants. Colours are
 * the same semantic roles as <TextInput>.
 *
 * `maxLength` drives the counter; pass null to hide it.
 */
export default function TextArea({
  label,
  optional = false,
  helper,
  error,
  value = '',
  onChangeText,
  placeholder,
  disabled = false,
  maxLength = 600,
  height = 132,
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
  const muted = { color: t.text.secondary };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: t.text.primary }]}>{label}</Text>
          {optional ? <Text style={[styles.optional, muted]}>Optional</Text> : null}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          {
            height,
            borderColor,
            borderWidth: focused && !disabled && !hasError ? 1.5 : 1,
            backgroundColor: disabled ? t.disabled.surface : t.background.primary,
          },
        ]}
      >
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.text.placeholder}
          keyboardAppearance={effective}
          editable={!disabled}
          multiline
          textAlignVertical="top"
          maxLength={maxLength ?? undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label}
          style={[styles.input, { color: t.text.primary }, inputStyle]}
          {...rest}
        />
      </View>

      <View style={styles.footer}>
        {helperText ? (
          <Text style={[styles.helper, hasError ? { color: t.error.primary } : muted]}>
            {helperText}
          </Text>
        ) : (
          <View />
        )}
        {maxLength ? (
          <Text style={[styles.counter, muted]}>{`${value?.length ?? 0}/${maxLength}`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignSelf: 'stretch' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Figma describes Text Area as mirroring Text Input, so the roles are its:
  // Caption label, Body Medium input, Inter Medium 12/140% helper. Multiline
  // input keeps the line height (the single-line iOS offset doesn't apply).
  label: { ...typography.caption },
  optional: { ...typography.caption },
  field: { padding: 16, borderRadius: 12 },
  input: { flex: 1, ...typography.bodyMedium, padding: 0 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  helper: { flex: 1, ...typography.captionEmphasized },
  counter: { ...typography.captionEmphasized },
});
