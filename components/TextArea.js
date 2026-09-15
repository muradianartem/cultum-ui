import { useState } from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { textInput } from '../theme/tokens';

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
 * and its own padding, none of which the single-line field wants.
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
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const helperText = typeof error === 'string' ? error : helper;

  const borderColor = hasError
    ? textInput.borderError
    : focused && !disabled
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

      <View
        style={[
          styles.field,
          {
            height,
            borderColor,
            borderWidth: focused && !disabled && !hasError ? 1.5 : 1,
            backgroundColor: disabled ? textInput.bgDisabled : textInput.bg,
          },
        ]}
      >
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={textInput.placeholder}
          editable={!disabled}
          multiline
          textAlignVertical="top"
          maxLength={maxLength ?? undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label}
          style={[styles.input, inputStyle]}
          {...rest}
        />
      </View>

      <View style={styles.footer}>
        {helperText ? (
          <Text style={[styles.helper, hasError && styles.helperError]}>{helperText}</Text>
        ) : (
          <View />
        )}
        {maxLength ? (
          <Text style={styles.counter}>{`${value?.length ?? 0}/${maxLength}`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignSelf: 'stretch' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, lineHeight: 17, color: textInput.labelInk },
  optional: { fontSize: 12, lineHeight: 17, color: textInput.optionalInk },
  field: { padding: 16, borderRadius: 12 },
  input: { flex: 1, fontSize: 14, lineHeight: 20, color: textInput.ink, padding: 0 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  helper: { flex: 1, fontSize: 12, lineHeight: 17, color: textInput.helperInk },
  helperError: { color: textInput.errorInk },
  counter: { fontSize: 12, lineHeight: 17, color: textInput.helperInk },
});
