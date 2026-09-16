import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchBar, radius } from '../theme/tokens';
import { useTheme, useThemeMode } from '../theme/ThemeProvider';

/**
 * SearchBar — pill search field, imported from Figma "Search Bar – P2".
 *
 * A 48px filled pill with a leading search glyph, the input, and a trailing
 * clear button once there's text (Filled=True). Figma State axis → behaviour:
 *   Active   → focus, which adds a 1px ink border
 *   Disabled → `editable={false}` + greyed fill
 *
 * Controlled: `value` + `onChangeText`. `onClear` (defaults to clearing via
 * onChangeText). `leftIcon` / `clearIcon` override the default 🔍 and ✕ text
 * glyphs, so callers can pass real <Icon>s.
 */
export default function SearchBar({
  value = '',
  onChangeText,
  placeholder = 'Search',
  onClear,
  leftIcon,
  clearIcon,
  disabled = false,
  style,
  inputStyle,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const { effective } = useThemeMode();
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: disabled ? t.disabled.surface : t.surface.primary,
        },
        focused && !disabled && { borderWidth: 1, borderColor: t.text.primary },
        style,
      ]}
    >
      <View style={styles.leadingIcon}>
        {leftIcon ?? <Text style={styles.searchGlyph}>🔍</Text>}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.text.placeholder}
        keyboardAppearance={effective}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[
          styles.input,
          { color: disabled ? t.disabled.on : t.text.primary },
          inputStyle,
        ]}
        returnKeyType="search"
        {...rest}
      />

      {filled && !disabled ? (
        <Pressable
          onPress={() => (onClear ? onClear() : onChangeText?.(''))}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={[styles.clear, { backgroundColor: t.brand.secondary }]}
        >
          {clearIcon ?? <Text style={[styles.clearGlyph, { color: t.text.primary }]}>✕</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: searchBar.height,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  leadingIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  searchGlyph: { fontSize: 15 },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clear: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearGlyph: { fontSize: 13 },
});
