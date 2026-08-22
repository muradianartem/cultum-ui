import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchBar, radius } from '../theme/tokens';

/**
 * SearchBar — pill search field, imported from Figma "Search Bar – P2".
 *
 * A 48px filled pill with a leading search glyph, the input, and a trailing
 * clear button once there's text (Filled=True). Figma State axis → behaviour:
 *   Active   → focus, which adds a 1px ink border
 *   Disabled → `editable={false}` + greyed fill
 *
 * Controlled: `value` + `onChangeText`. `onClear` (defaults to clearing via
 * onChangeText). `leftIcon` overrides the default 🔍 glyph (no react-native-svg).
 */
export default function SearchBar({
  value = '',
  onChangeText,
  placeholder = 'Search',
  onClear,
  leftIcon,
  disabled = false,
  style,
  inputStyle,
  accessibilityLabel,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: disabled ? searchBar.bgDisabled : searchBar.bg,
        },
        focused && !disabled && styles.focused,
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
        placeholderTextColor={searchBar.placeholder}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[styles.input, disabled && { color: '#404140' }, inputStyle]}
        returnKeyType="search"
        {...rest}
      />

      {filled && !disabled ? (
        <Pressable
          onPress={() => (onClear ? onClear() : onChangeText?.(''))}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          <Text style={styles.clearGlyph}>✕</Text>
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
  focused: { borderWidth: 1, borderColor: searchBar.focusBorder },
  leadingIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  searchGlyph: { fontSize: 15 },
  input: {
    flex: 1,
    fontSize: 16,
    color: searchBar.ink,
    padding: 0,
  },
  clear: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: searchBar.clearBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearGlyph: { fontSize: 13, color: searchBar.ink },
});
