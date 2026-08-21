import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { textInput } from '../theme/tokens';

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
 * turns it red. Controlled via `value` + `onChangeText`.
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
            borderColor,
            borderWidth: focused && !disabled && !hasError ? 1.5 : 1,
            backgroundColor: disabled ? textInput.bgDisabled : textInput.bg,
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={textInput.placeholder}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label}
          style={[styles.input, inputStyle]}
          {...rest}
        />
        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>

      {helperText ? (
        <Text style={[styles.helper, hasError && styles.helperError]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, alignSelf: 'stretch' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, lineHeight: 17, color: textInput.labelInk },
  optional: { fontSize: 12, lineHeight: 17, color: textInput.optionalInk },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: textInput.height,
    paddingHorizontal: 16,
    borderRadius: textInput.radius,
  },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 14, color: textInput.ink, padding: 0 },
  helper: { fontSize: 12, lineHeight: 17, color: textInput.helperInk },
  helperError: { color: textInput.errorInk },
});
